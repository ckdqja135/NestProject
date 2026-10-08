import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Not } from 'typeorm';
import { ChannelChats } from '../entities/ChannelChats';
import { ChannelMembers } from '../entities/ChannelMembers';
import { Channels } from '../entities/Channels';
import { Users } from '../entities/Users';
import { WorkspaceMembers } from '../entities/WorkspaceMembers';
import { EventsGateway } from '../events/events.gateway';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { ChannelsService } from './channels.service';

describe('ChannelsService', () => {
  let service: ChannelsService;
  const channelsRepository = { findOne: jest.fn() };
  const channelChatsRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
  };
  const workspacesService = {
    findWorkspaceByUrl: jest.fn(),
    assertMember: jest.fn(),
  };
  const emit = jest.fn();
  const eventsGateway = { server: { to: jest.fn(() => ({ emit })) } };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelsService,
        { provide: getRepositoryToken(Channels), useValue: channelsRepository },
        { provide: getRepositoryToken(ChannelMembers), useValue: {} },
        {
          provide: getRepositoryToken(ChannelChats),
          useValue: channelChatsRepository,
        },
        { provide: getRepositoryToken(Users), useValue: {} },
        { provide: getRepositoryToken(WorkspaceMembers), useValue: {} },
        { provide: WorkspacesService, useValue: workspacesService },
        { provide: EventsGateway, useValue: eventsGateway },
      ],
    }).compile();

    service = module.get<ChannelsService>(ChannelsService);
    workspacesService.findWorkspaceByUrl.mockResolvedValue({ id: 1 });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('없는 채널이면 NotFoundException', async () => {
    channelsRepository.findOne.mockResolvedValue(null);
    await expect(
      service.getWorkspaceChannel('sleact', 'nope', 1),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('채팅 저장 후 채널 룸으로 message 이벤트를 보낸다', async () => {
    channelsRepository.findOne.mockResolvedValue({ id: 3, WorkspaceId: 1 });
    channelChatsRepository.save.mockResolvedValue({ id: 9 });
    const chatWithUser = { id: 9, content: '안녕', User: { id: 1 } };
    channelChatsRepository.findOne.mockResolvedValue(chatWithUser);

    await service.postChat('sleact', '일반', '안녕', 1);

    expect(channelChatsRepository.save).toHaveBeenCalledWith({
      content: '안녕',
      UserId: 1,
      ChannelId: 3,
    });
    expect(eventsGateway.server.to).toHaveBeenCalledWith('/ws-sleact-3');
    expect(emit).toHaveBeenCalledWith('message', chatWithUser);
  });

  it('안 읽은 메시지 수에서 내가 보낸 메시지는 제외한다', async () => {
    channelsRepository.findOne.mockResolvedValue({ id: 3, WorkspaceId: 1 });
    channelChatsRepository.count.mockResolvedValue(1);

    await expect(
      service.getChannelUnreadsCount('sleact', '일반', 1000, 7),
    ).resolves.toBe(1);
    expect(channelChatsRepository.count).toHaveBeenCalledWith({
      where: {
        ChannelId: 3,
        UserId: Not(7),
        createdAt: expect.any(Object),
      },
    });
  });
});
