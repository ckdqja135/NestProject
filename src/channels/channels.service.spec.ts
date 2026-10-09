import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull, Not } from 'typeorm';
import { ChannelChats } from '../entities/ChannelChats';
import { ChannelMembers } from '../entities/ChannelMembers';
import { Channels } from '../entities/Channels';
import { Reactions } from '../entities/Reactions';
import { Users } from '../entities/Users';
import { WorkspaceMembers } from '../entities/WorkspaceMembers';
import { EventsGateway } from '../events/events.gateway';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { ChannelsService } from './channels.service';

// createQueryBuilder() 체이닝을 흉내내는 mock. getOne/getMany 결과만 지정해서 쓴다.
const createQueryBuilderMock = () => {
  const qb: Record<string, jest.Mock> = {};
  [
    'leftJoinAndSelect',
    'loadRelationCountAndMap',
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
    'take',
    'skip',
  ].forEach((method) => {
    qb[method] = jest.fn(() => qb);
  });
  qb.getOne = jest.fn();
  qb.getMany = jest.fn();
  return qb;
};

describe('ChannelsService', () => {
  let service: ChannelsService;
  let qb: ReturnType<typeof createQueryBuilderMock>;
  const channelsRepository = { findOne: jest.fn() };
  const channelMembersRepository = { delete: jest.fn() };
  const channelChatsRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const reactionsRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const workspacesService = {
    findWorkspaceByUrl: jest.fn(),
    assertMember: jest.fn(),
  };
  const emit = jest.fn();
  const eventsGateway = { server: { to: jest.fn(() => ({ emit })) } };
  const channel = { id: 3, name: '일반', WorkspaceId: 1 };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelsService,
        { provide: getRepositoryToken(Channels), useValue: channelsRepository },
        {
          provide: getRepositoryToken(ChannelMembers),
          useValue: channelMembersRepository,
        },
        {
          provide: getRepositoryToken(ChannelChats),
          useValue: channelChatsRepository,
        },
        {
          provide: getRepositoryToken(Reactions),
          useValue: reactionsRepository,
        },
        { provide: getRepositoryToken(Users), useValue: {} },
        { provide: getRepositoryToken(WorkspaceMembers), useValue: {} },
        { provide: WorkspacesService, useValue: workspacesService },
        { provide: EventsGateway, useValue: eventsGateway },
      ],
    }).compile();

    service = module.get<ChannelsService>(ChannelsService);
    qb = createQueryBuilderMock();
    channelChatsRepository.createQueryBuilder.mockReturnValue(qb);
    workspacesService.findWorkspaceByUrl.mockResolvedValue({ id: 1 });
    channelsRepository.findOne.mockResolvedValue(channel);
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

  it('채팅 저장 후 채널 룸으로 message 이벤트를 보내고 저장된 메시지를 반환한다', async () => {
    channelChatsRepository.save.mockResolvedValue({ id: 9 });
    const chatWithUser = { id: 9, content: '안녕', User: { id: 1 } };
    qb.getOne.mockResolvedValue(chatWithUser);

    await expect(service.postChat('sleact', '일반', '안녕', 1)).resolves.toBe(
      chatWithUser,
    );

    expect(channelChatsRepository.save).toHaveBeenCalledWith({
      content: '안녕',
      UserId: 1,
      ChannelId: 3,
      ParentId: null,
    });
    expect(eventsGateway.server.to).toHaveBeenCalledWith('/ws-sleact-3');
    expect(emit).toHaveBeenCalledWith('message', chatWithUser);
  });

  it('안 읽은 메시지 수에서 내가 보낸 메시지와 스레드 답글은 제외한다', async () => {
    channelChatsRepository.count.mockResolvedValue(1);

    await expect(
      service.getChannelUnreadsCount('sleact', '일반', 1000, 7),
    ).resolves.toBe(1);
    expect(channelChatsRepository.count).toHaveBeenCalledWith({
      where: {
        ChannelId: 3,
        UserId: Not(7),
        ParentId: IsNull(),
        createdAt: expect.any(Object),
      },
    });
  });

  describe('메시지 수정/삭제', () => {
    it('남이 보낸 메시지는 수정할 수 없다', async () => {
      channelChatsRepository.findOne.mockResolvedValue({ id: 9, UserId: 2 });
      await expect(
        service.editChat('sleact', '일반', 9, '수정', 1),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(channelChatsRepository.update).not.toHaveBeenCalled();
    });

    it('내 메시지를 수정하면 messageUpdated 이벤트를 보낸다', async () => {
      channelChatsRepository.findOne.mockResolvedValue({ id: 9, UserId: 1 });
      const updated = { id: 9, content: '수정' };
      qb.getOne.mockResolvedValue(updated);

      await service.editChat('sleact', '일반', 9, '수정', 1);

      expect(channelChatsRepository.update).toHaveBeenCalledWith(9, {
        content: '수정',
      });
      expect(emit).toHaveBeenCalledWith('messageUpdated', updated);
    });

    it('내 메시지를 삭제하면 messageDeleted 이벤트를 보낸다', async () => {
      channelChatsRepository.findOne.mockResolvedValue({
        id: 9,
        UserId: 1,
        ParentId: null,
      });

      await service.deleteChat('sleact', '일반', 9, 1);

      expect(channelChatsRepository.delete).toHaveBeenCalledWith(9);
      expect(emit).toHaveBeenCalledWith('messageDeleted', {
        id: 9,
        ChannelId: 3,
        ParentId: null,
      });
    });
  });

  describe('스레드', () => {
    it('답글은 ParentId 를 넣어 저장한다', async () => {
      channelChatsRepository.findOne.mockResolvedValue({
        id: 9,
        ParentId: null,
      });
      channelChatsRepository.save.mockResolvedValue({ id: 10 });
      qb.getOne.mockResolvedValue({ id: 10, ParentId: 9 });

      await service.postReply('sleact', '일반', 9, '답글', 2);

      expect(channelChatsRepository.save).toHaveBeenCalledWith({
        content: '답글',
        UserId: 2,
        ChannelId: 3,
        ParentId: 9,
      });
    });

    it('답글에는 다시 답글을 달 수 없다', async () => {
      channelChatsRepository.findOne.mockResolvedValue({ id: 10, ParentId: 9 });
      await expect(
        service.postReply('sleact', '일반', 10, '답글', 2),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('리액션', () => {
    beforeEach(() => {
      channelChatsRepository.findOne.mockResolvedValue({
        id: 9,
        ParentId: null,
      });
      reactionsRepository.find.mockResolvedValue([]);
    });

    it('누르지 않은 이모지면 추가한다', async () => {
      reactionsRepository.findOne.mockResolvedValue(null);
      await service.toggleReaction('sleact', '일반', 9, '👍', 1);
      expect(reactionsRepository.save).toHaveBeenCalledWith({
        ChatId: 9,
        UserId: 1,
        emoji: '👍',
      });
      expect(emit).toHaveBeenCalledWith(
        'reactionUpdated',
        expect.objectContaining({ id: 9, ChannelId: 3 }),
      );
    });

    it('이미 누른 이모지면 취소한다', async () => {
      reactionsRepository.findOne.mockResolvedValue({ id: 5 });
      await service.toggleReaction('sleact', '일반', 9, '👍', 1);
      expect(reactionsRepository.delete).toHaveBeenCalledWith(5);
      expect(reactionsRepository.save).not.toHaveBeenCalled();
    });
  });

  it('메시지 고정 상태를 바꾸고 messageUpdated 이벤트를 보낸다', async () => {
    channelChatsRepository.findOne.mockResolvedValue({ id: 9, UserId: 2 });
    qb.getOne.mockResolvedValue({ id: 9, pinned: true });

    await service.setPinned('sleact', '일반', 9, true, 1);

    expect(channelChatsRepository.update).toHaveBeenCalledWith(9, {
      pinned: true,
    });
    expect(emit).toHaveBeenCalledWith('messageUpdated', {
      id: 9,
      pinned: true,
    });
  });

  describe('채널 나가기', () => {
    it('일반 채널은 나갈 수 없다', async () => {
      await expect(
        service.leaveChannel('sleact', '일반', 1),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(channelMembersRepository.delete).not.toHaveBeenCalled();
    });

    it('다른 채널은 멤버에서 제거된다', async () => {
      channelsRepository.findOne.mockResolvedValue({ id: 4, name: '자유' });
      await service.leaveChannel('sleact', '자유', 1);
      expect(channelMembersRepository.delete).toHaveBeenCalledWith({
        ChannelId: 4,
        UserId: 1,
      });
    });
  });
});
