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
import { MentionsService } from '../mentions/mentions.service';
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
  const channelsRepository = { findOne: jest.fn(), save: jest.fn() };
  const channelMembersRepository = {
    delete: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
  };
  const channelChatsRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
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
  const mentionsService = {
    handleNewChat: jest.fn(),
    removeForChats: jest.fn(),
  };
  const emit = jest.fn();
  const eventsGateway = {
    server: { to: jest.fn(() => ({ emit })) },
    refreshUserChannels: jest.fn(),
    emitToUser: jest.fn(),
  };
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
        { provide: MentionsService, useValue: mentionsService },
      ],
    }).compile();

    service = module.get<ChannelsService>(ChannelsService);
    qb = createQueryBuilderMock();
    channelChatsRepository.createQueryBuilder.mockReturnValue(qb);
    workspacesService.findWorkspaceByUrl.mockResolvedValue({ id: 1 });
    channelsRepository.findOne.mockResolvedValue(channel);
    // 기본: 요청한 사람은 채널 멤버
    channelMembersRepository.findOne.mockResolvedValue({
      ChannelId: 3,
      UserId: 1,
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('없는 채널이면 NotFoundException', async () => {
    channelsRepository.findOne.mockResolvedValue(null);
    await expect(
      service.getWorkspaceChannel('shlack', 'nope', 1),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('채팅 저장 후 채널 룸으로 message 이벤트를 보내고 저장된 메시지를 반환한다', async () => {
    channelChatsRepository.save.mockResolvedValue({ id: 9 });
    const chatWithUser = { id: 9, content: '안녕', User: { id: 1 } };
    qb.getOne.mockResolvedValue(chatWithUser);

    await expect(service.postChat('shlack', '일반', '안녕', 1)).resolves.toBe(
      chatWithUser,
    );

    expect(channelChatsRepository.save).toHaveBeenCalledWith({
      content: '안녕',
      UserId: 1,
      ChannelId: 3,
      ParentId: null,
    });
    expect(eventsGateway.server.to).toHaveBeenCalledWith('/ws-shlack-3');
    expect(emit).toHaveBeenCalledWith('message', chatWithUser);
    expect(mentionsService.handleNewChat).toHaveBeenCalledWith(
      'shlack',
      1,
      chatWithUser,
    );
  });

  it('안 읽은 메시지 수에서 내가 보낸 메시지와 스레드 답글은 제외한다', async () => {
    channelChatsRepository.count.mockResolvedValue(1);

    await expect(
      service.getChannelUnreadsCount('shlack', '일반', 1000, 7),
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
        service.editChat('shlack', '일반', 9, '수정', 1),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(channelChatsRepository.update).not.toHaveBeenCalled();
    });

    it('내 메시지를 수정하면 messageUpdated 이벤트를 보낸다', async () => {
      channelChatsRepository.findOne.mockResolvedValue({ id: 9, UserId: 1 });
      const updated = { id: 9, content: '수정' };
      qb.getOne.mockResolvedValue(updated);

      await service.editChat('shlack', '일반', 9, '수정', 1);

      expect(channelChatsRepository.update).toHaveBeenCalledWith(9, {
        content: '수정',
        editedAt: expect.any(Date),
      });
      expect(emit).toHaveBeenCalledWith('messageUpdated', updated);
    });

    it('내 메시지를 삭제하면 messageDeleted 이벤트를 보낸다', async () => {
      channelChatsRepository.findOne.mockResolvedValue({
        id: 9,
        UserId: 1,
        ParentId: null,
      });

      channelChatsRepository.find.mockResolvedValue([{ id: 10 }]);
      await service.deleteChat('shlack', '일반', 9, 1);

      expect(channelChatsRepository.delete).toHaveBeenCalledWith(9);
      expect(mentionsService.removeForChats).toHaveBeenCalledWith(
        'shlack',
        [9, 10],
      );
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

      await service.postReply('shlack', '일반', 9, '답글', 2);

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
        service.postReply('shlack', '일반', 10, '답글', 2),
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
      await service.toggleReaction('shlack', '일반', 9, '👍', 1);
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
      await service.toggleReaction('shlack', '일반', 9, '👍', 1);
      expect(reactionsRepository.delete).toHaveBeenCalledWith(5);
      expect(reactionsRepository.save).not.toHaveBeenCalled();
    });
  });

  it('메시지 고정 상태를 바꾸고 messageUpdated 이벤트를 보낸다', async () => {
    channelChatsRepository.findOne.mockResolvedValue({ id: 9, UserId: 2 });
    qb.getOne.mockResolvedValue({ id: 9, pinned: true });

    await service.setPinned('shlack', '일반', 9, true, 1);

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
        service.leaveChannel('shlack', '일반', 1),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(channelMembersRepository.delete).not.toHaveBeenCalled();
    });

    it('다른 채널은 멤버에서 제거된다', async () => {
      channelsRepository.findOne.mockResolvedValue({ id: 4, name: '자유' });
      await service.leaveChannel('shlack', '자유', 1);
      expect(channelMembersRepository.delete).toHaveBeenCalledWith({
        ChannelId: 4,
        UserId: 1,
      });
    });
  });

  describe('채널 알림 끄기', () => {
    it('내 채널 멤버 정보에만 muted 를 저장하고 내 탭들에 목록 갱신을 알린다', async () => {
      channelsRepository.findOne.mockResolvedValue({ id: 4, name: '자유' });
      await service.setChannelMuted('shlack', '자유', 1, true);
      expect(channelMembersRepository.update).toHaveBeenCalledWith(
        { ChannelId: 4, UserId: 1 },
        { muted: true },
      );
      expect(eventsGateway.emitToUser).toHaveBeenCalledWith(
        'shlack',
        1,
        'channelsChanged',
      );
    });
  });

  describe('공개/비공개 채널', () => {
    it('멤버가 아니면 비공개 채널은 존재 자체를 숨긴다 (404)', async () => {
      channelsRepository.findOne.mockResolvedValue({
        ...channel,
        private: true,
      });
      channelMembersRepository.findOne.mockResolvedValue(null);
      await expect(
        service.getWorkspaceChannelChats('shlack', '비밀', 20, 1, 9),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('멤버가 아니면 공개 채널도 참여 전에는 이용할 수 없다 (403)', async () => {
      channelsRepository.findOne.mockResolvedValue({
        ...channel,
        private: false,
      });
      channelMembersRepository.findOne.mockResolvedValue(null);
      await expect(
        service.postChat('shlack', '자유', '안녕', 9),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(channelChatsRepository.save).not.toHaveBeenCalled();
    });

    it('비공개 채널로 생성할 수 있다', async () => {
      channelsRepository.findOne.mockResolvedValue(null);
      channelsRepository.save.mockResolvedValue({ id: 5 });
      await service.createWorkspaceChannel('shlack', '비밀', true, 1);
      expect(channelsRepository.save).toHaveBeenCalledWith({
        name: '비밀',
        WorkspaceId: 1,
        private: true,
      });
      expect(channelMembersRepository.save).toHaveBeenCalledWith({
        UserId: 1,
        ChannelId: 5,
      });
    });

    it("'browse' 는 채널 이름으로 쓸 수 없다", async () => {
      await expect(
        service.createWorkspaceChannel('shlack', 'browse', false, 1),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('공개 채널에는 스스로 참여할 수 있다', async () => {
      channelsRepository.findOne.mockResolvedValue({ id: 4, private: false });
      channelMembersRepository.findOne.mockResolvedValue(null);
      await service.joinChannel('shlack', '자유', 9);
      expect(channelMembersRepository.save).toHaveBeenCalledWith({
        ChannelId: 4,
        UserId: 9,
      });
    });

    it('비공개 채널에는 스스로 참여할 수 없다', async () => {
      channelsRepository.findOne.mockResolvedValue({ id: 4, private: true });
      await expect(
        service.joinChannel('shlack', '비밀', 9),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(channelMembersRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('채팅 목록 커서', () => {
    it('beforeId 가 있으면 그보다 오래된 메시지를 id 순으로 가져온다', async () => {
      qb.getMany.mockResolvedValue([]);
      await service.getWorkspaceChannelChats('shlack', '일반', 20, 1, 1, 50);
      expect(qb.orderBy).toHaveBeenCalledWith('chats.id', 'DESC');
      expect(qb.andWhere).toHaveBeenCalledWith('chats.id < :beforeId', {
        beforeId: 50,
      });
      expect(qb.skip).not.toHaveBeenCalled();
    });

    it('beforeId 가 없으면 기존 page 방식으로 동작한다', async () => {
      qb.getMany.mockResolvedValue([]);
      await service.getWorkspaceChannelChats('shlack', '일반', 20, 2, 1);
      expect(qb.skip).toHaveBeenCalledWith(20);
    });
  });

  it('채널에 초대하면 초대받은 사람의 소켓 방을 바로 맞춘다', async () => {
    const userQb = {
      innerJoin: jest.fn(() => userQb),
      where: jest.fn(() => userQb),
      getOne: jest.fn().mockResolvedValue({ id: 9 }),
    };
    const usersRepository = (service as any).usersRepository;
    usersRepository.createQueryBuilder = jest.fn(() => userQb);
    channelMembersRepository.findOne
      .mockResolvedValueOnce({ ChannelId: 3, UserId: 1 }) // 초대하는 사람은 멤버
      .mockResolvedValueOnce(null); // 초대받는 사람은 아직 멤버 아님

    await service.createWorkspaceChannelMembers('shlack', '일반', 'b@b.com', 1);

    expect(channelMembersRepository.save).toHaveBeenCalledWith({
      ChannelId: 3,
      UserId: 9,
    });
    expect(eventsGateway.refreshUserChannels).toHaveBeenCalledWith('shlack', 9);
  });

  it('파일은 정보만 채팅으로 저장하고 내용은 채널에 중계한다 (디스크 저장 없음)', async () => {
    channelChatsRepository.save.mockResolvedValue({ id: 20 });
    qb.getOne.mockResolvedValue({ id: 20 });
    const id = '3f2b8c1e-1a2b-4c3d-8e9f-0123456789ab';
    const buffer = Buffer.from('hello');

    await service.sendChannelFiles(
      'shlack',
      '일반',
      [
        {
          originalname: 'a.txt',
          mimetype: 'text/plain',
          size: 5,
          buffer,
        } as any,
      ],
      [id],
      1,
    );

    expect(channelChatsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        content: `file:{"id":"${id}","name":"a.txt","type":"text/plain","size":5}`,
      }),
    );
    expect(emit).toHaveBeenCalledWith('fileData', {
      id,
      name: 'a.txt',
      type: 'text/plain',
      size: 5,
      data: buffer,
    });
  });
});
