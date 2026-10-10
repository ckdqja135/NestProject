import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChannelsService } from '../channels/channels.service';
import { DmsService } from '../dms/dms.service';
import { ChannelChats } from '../entities/ChannelChats';
import { ChannelMembers } from '../entities/ChannelMembers';
import { DMs } from '../entities/DMs';
import { Reminders } from '../entities/Reminders';
import { ScheduledMessages } from '../entities/ScheduledMessages';
import { EventsGateway } from '../events/events.gateway';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { ScheduledService } from './scheduled.service';

describe('ScheduledService', () => {
  let service: ScheduledService;
  const scheduledRepository = {
    find: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const remindersRepository = {
    find: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const workspacesService = {
    findWorkspaceByUrl: jest.fn(),
    assertMember: jest.fn(),
  };
  const channelsService = {
    getWorkspaceChannel: jest.fn(),
    postChat: jest.fn(),
  };
  const dmsService = { createWorkspaceDMChats: jest.fn() };
  const eventsGateway = { emitToUser: jest.fn(), isOnline: jest.fn() };
  const inMinutes = (m: number) =>
    new Date(Date.now() + m * 60_000).toISOString();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduledService,
        {
          provide: getRepositoryToken(ScheduledMessages),
          useValue: scheduledRepository,
        },
        {
          provide: getRepositoryToken(Reminders),
          useValue: remindersRepository,
        },
        { provide: getRepositoryToken(ChannelChats), useValue: {} },
        { provide: getRepositoryToken(ChannelMembers), useValue: {} },
        { provide: getRepositoryToken(DMs), useValue: {} },
        { provide: WorkspacesService, useValue: workspacesService },
        { provide: ChannelsService, useValue: channelsService },
        { provide: DmsService, useValue: dmsService },
        { provide: EventsGateway, useValue: eventsGateway },
      ],
    }).compile();
    service = module.get(ScheduledService);
    workspacesService.findWorkspaceByUrl.mockResolvedValue({ id: 1 });
    scheduledRepository.find.mockResolvedValue([]);
    remindersRepository.find.mockResolvedValue([]);
  });

  it('지난 시각이나 1년 넘는 시각으로는 예약할 수 없다', async () => {
    await expect(
      service.createScheduled(
        'shlack',
        { channel: '일반', content: '안녕', sendAt: inMinutes(-1) },
        1,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createScheduled(
        'shlack',
        { channel: '일반', content: '안녕', sendAt: inMinutes(60 * 24 * 400) },
        1,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(scheduledRepository.save).not.toHaveBeenCalled();
  });

  it('채널과 DM 을 함께 지정할 수 없다', async () => {
    await expect(
      service.createScheduled(
        'shlack',
        {
          channel: '일반',
          receiverId: 2,
          content: '안녕',
          sendAt: inMinutes(5),
        },
        1,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('보관된 채널에는 예약할 수 없다', async () => {
    channelsService.getWorkspaceChannel.mockResolvedValue({
      id: 4,
      archived: true,
    });
    await expect(
      service.createScheduled(
        'shlack',
        { channel: '자유', content: '안녕', sendAt: inMinutes(5) },
        1,
      ),
    ).rejects.toThrow('보관된 채널에는 쓸 수 없습니다.');
  });

  it('시각이 된 예약 메시지를 보내고 목록에서 지운다', async () => {
    scheduledRepository.find.mockResolvedValue([
      {
        id: 1,
        UserId: 7,
        ChannelId: 4,
        Channel: { name: '자유' },
        content: '채널 예약',
        Workspace: { url: 'shlack' },
      },
      {
        id: 2,
        UserId: 7,
        ReceiverId: 9,
        content: 'DM 예약',
        Workspace: { url: 'shlack' },
      },
    ]);
    await service.tick();
    expect(channelsService.postChat).toHaveBeenCalledWith(
      'shlack',
      '자유',
      '채널 예약',
      7,
    );
    expect(dmsService.createWorkspaceDMChats).toHaveBeenCalledWith(
      'shlack',
      'DM 예약',
      9,
      7,
    );
    expect(scheduledRepository.delete).toHaveBeenCalledWith(1);
    expect(scheduledRepository.delete).toHaveBeenCalledWith(2);
  });

  it('보내지 못하면 다시 시도하지 않고 보낸 사람에게 알린다', async () => {
    scheduledRepository.find.mockResolvedValue([
      {
        id: 1,
        UserId: 7,
        ChannelId: 4,
        Channel: { name: '자유' },
        content: '나간 채널',
        Workspace: { url: 'shlack' },
      },
    ]);
    channelsService.postChat.mockRejectedValueOnce(
      new Error('채널에 참여한 뒤 이용할 수 있습니다.'),
    );
    await service.tick();
    expect(scheduledRepository.delete).toHaveBeenCalledWith(1);
    expect(eventsGateway.emitToUser).toHaveBeenCalledWith(
      'shlack',
      7,
      'scheduledFailed',
      { content: '나간 채널', reason: '채널에 참여한 뒤 이용할 수 있습니다.' },
    );
  });

  it('리마인더는 접속해 있을 때만 알리고, 아니면 다음으로 미룬다', async () => {
    const reminder = {
      id: 3,
      UserId: 7,
      Workspace: { url: 'shlack' },
      Chat: { id: 9 },
      DM: null,
    };
    remindersRepository.find.mockResolvedValue([reminder]);
    eventsGateway.isOnline.mockReturnValue(false);
    await service.tick();
    expect(remindersRepository.delete).not.toHaveBeenCalled();

    eventsGateway.isOnline.mockReturnValue(true);
    await service.tick();
    expect(remindersRepository.delete).toHaveBeenCalledWith(3);
    expect(eventsGateway.emitToUser).toHaveBeenCalledWith(
      'shlack',
      7,
      'reminder',
      { id: 3, chat: { id: 9 }, dm: null },
    );
  });
});
