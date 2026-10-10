import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChannelMembers } from '../entities/ChannelMembers';
import { Mentions } from '../entities/Mentions';
import { EventsGateway } from '../events/events.gateway';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { onlineMap } from '../events/onlineMap';
import {
  MentionsService,
  parseMentionIds,
  parseSpecialMentions,
} from './mentions.service';

describe('MentionsService', () => {
  let service: MentionsService;
  const mentionsRepository = {
    save: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };
  const channelMembersRepository = { find: jest.fn() };
  const eventsGateway = { emitToUser: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MentionsService,
        { provide: getRepositoryToken(Mentions), useValue: mentionsRepository },
        {
          provide: getRepositoryToken(ChannelMembers),
          useValue: channelMembersRepository,
        },
        { provide: WorkspacesService, useValue: {} },
        { provide: EventsGateway, useValue: eventsGateway },
      ],
    }).compile();
    service = module.get(MentionsService);
  });

  it('멘션 마크업에서 사용자 id 를 중복 없이 추출한다', () => {
    expect(
      parseMentionIds('안녕 @[bob](2) 그리고 @[carol](3), 다시 @[bob](2)'),
    ).toEqual([2, 3]);
    expect(parseMentionIds('멘션 없음 @bob')).toEqual([]);
  });

  it('채널 멤버인 사람에게만 멘션을 기록하고 알린다 (본인 제외)', async () => {
    // 2: 채널 멤버, 3: 멤버 아님, 1: 보낸 사람 본인
    channelMembersRepository.find.mockResolvedValue([{ UserId: 2 }]);
    mentionsRepository.save.mockResolvedValue({ id: 77 });
    const chat = {
      id: 9,
      ChannelId: 4,
      UserId: 1,
      content: '@[bob](2) @[carol](3) @[me](1)',
    } as any;

    await service.handleNewChat('shlack', 1, chat);

    expect(channelMembersRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ChannelId: 4 }),
      }),
    );
    expect(mentionsRepository.save).toHaveBeenCalledTimes(1);
    expect(mentionsRepository.save).toHaveBeenCalledWith({
      category: 'chat',
      ChatId: 9,
      WorkspaceId: 1,
      SenderId: 1,
      ReceiverId: 2,
    });
    expect(eventsGateway.emitToUser).toHaveBeenCalledWith(
      'shlack',
      2,
      'mention',
      {
        id: 77,
        chat,
      },
    );
  });

  it('@channel 은 채널 멤버 모두, @here 는 접속 중인 채널 멤버에게 알린다', async () => {
    expect(parseSpecialMentions('@[channel](channel) 공지')).toEqual({
      channel: true,
      here: false,
    });
    expect(parseSpecialMentions('@[here](channel) 섞인 마크업')).toEqual({
      channel: false,
      here: false,
    });
    channelMembersRepository.find.mockResolvedValue([
      { UserId: 1 },
      { UserId: 2 },
      { UserId: 3 },
    ]);
    mentionsRepository.save.mockResolvedValue({ id: 1 });
    await service.handleNewChat('shlack', 1, {
      id: 9,
      ChannelId: 4,
      UserId: 1,
      content: '@[channel](channel) 공지',
    } as any);
    expect(
      mentionsRepository.save.mock.calls.map(([m]) => m.ReceiverId),
    ).toEqual([2, 3]);

    jest.clearAllMocks();
    channelMembersRepository.find.mockResolvedValue([
      { UserId: 1 },
      { UserId: 2 },
      { UserId: 3 },
    ]);
    mentionsRepository.save.mockResolvedValue({ id: 1 });
    onlineMap['/ws-shlack'] = { s1: 1, s2: 3 };
    await service.handleNewChat('shlack', 1, {
      id: 10,
      ChannelId: 4,
      UserId: 1,
      content: '@[here](here) 지금 있는 분',
    } as any);
    delete onlineMap['/ws-shlack'];
    expect(
      mentionsRepository.save.mock.calls.map(([m]) => m.ReceiverId),
    ).toEqual([3]);
  });

  it('멘션이 없으면 아무것도 하지 않는다', async () => {
    await service.handleNewChat('shlack', 1, {
      id: 9,
      ChannelId: 4,
      UserId: 1,
      content: '그냥 메시지',
    } as any);
    expect(channelMembersRepository.find).not.toHaveBeenCalled();
  });

  it('메시지가 삭제되면 관련 멘션을 지우고 받은 사람에게 알린다', async () => {
    mentionsRepository.find.mockResolvedValue([
      { id: 1, ReceiverId: 2 },
      { id: 2, ReceiverId: 2 },
      { id: 3, ReceiverId: 5 },
    ]);
    await service.removeForChats('shlack', [9, 10]);
    expect(mentionsRepository.delete).toHaveBeenCalled();
    expect(eventsGateway.emitToUser).toHaveBeenCalledTimes(2);
    expect(eventsGateway.emitToUser).toHaveBeenCalledWith(
      'shlack',
      5,
      'mentionsChanged',
    );
  });
});
