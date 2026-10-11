import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DMs } from '../entities/DMs';
import { DMReactions } from '../entities/DMReactions';
import { MessageEdits } from '../entities/MessageEdits';
import { DMReads } from '../entities/DMReads';
import { EventsGateway } from '../events/events.gateway';
import { onlineMap } from '../events/onlineMap';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { DmsService } from './dms.service';

describe('DmsService', () => {
  let service: DmsService;
  const dmsRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const dmReactionsRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const messageEditsRepository = { save: jest.fn(), find: jest.fn() };
  const dmReadsRepository = { findOne: jest.fn(), save: jest.fn() };
  const workspacesService = {
    findWorkspaceByUrl: jest.fn(),
    assertMember: jest.fn(),
  };
  const emit = jest.fn();
  const eventsGateway = {
    server: { to: jest.fn(() => ({ emit })) },
    emitToUser: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DmsService,
        { provide: getRepositoryToken(DMs), useValue: dmsRepository },
        {
          provide: getRepositoryToken(DMReactions),
          useValue: dmReactionsRepository,
        },
        {
          provide: getRepositoryToken(MessageEdits),
          useValue: messageEditsRepository,
        },
        { provide: getRepositoryToken(DMReads), useValue: dmReadsRepository },
        { provide: WorkspacesService, useValue: workspacesService },
        { provide: EventsGateway, useValue: eventsGateway },
      ],
    }).compile();

    service = module.get<DmsService>(DmsService);
    workspacesService.findWorkspaceByUrl.mockResolvedValue({ id: 1 });
  });

  afterEach(() => {
    delete onlineMap['/ws-shlack'];
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('DM 저장 후 받는 사람과 보낸 사람의 소켓으로 dm 이벤트를 보낸다', async () => {
    onlineMap['/ws-shlack'] = { socketA: 1, socketB: 2, socketC: 3 };
    dmsRepository.save.mockResolvedValue({ id: 5 });
    const dm = { id: 5, content: '안녕', SenderId: 1, ReceiverId: 2 };
    dmsRepository.findOne.mockResolvedValue(dm);

    await service.createWorkspaceDMChats('shlack', '안녕', 2, 1);

    expect(dmsRepository.save).toHaveBeenCalledWith({
      content: '안녕',
      SenderId: 1,
      ReceiverId: 2,
      WorkspaceId: 1,
    });
    expect(eventsGateway.server.to).toHaveBeenCalledWith([
      'socketB',
      'socketA',
    ]);
    expect(emit).toHaveBeenCalledWith('dm', dm);
  });

  it('접속 중인 소켓이 없으면 이벤트를 보내지 않는다', async () => {
    dmsRepository.save.mockResolvedValue({ id: 5 });
    dmsRepository.findOne.mockResolvedValue({ id: 5 });

    await service.createWorkspaceDMChats('shlack', '안녕', 2, 1);

    expect(eventsGateway.server.to).not.toHaveBeenCalled();
  });

  describe('DM 읽음 표시', () => {
    it('상대가 보낸 마지막 메시지까지만 읽음으로 기록하고 상대에게 알린다', async () => {
      dmsRepository.findOne.mockResolvedValue({ id: 30 });
      dmReadsRepository.findOne.mockResolvedValue(null);
      await expect(service.markRead('shlack', 2, 999, 1)).resolves.toEqual({
        lastReadId: 30,
      });
      expect(dmReadsRepository.save).toHaveBeenCalledWith({
        WorkspaceId: 1,
        UserId: 1,
        PartnerId: 2,
        lastReadId: 30,
      });
      expect(eventsGateway.emitToUser).toHaveBeenCalledWith(
        'shlack',
        2,
        'dmRead',
        {
          readerId: 1,
          lastReadId: 30,
        },
      );
    });

    it('이미 더 뒤까지 읽었으면 바꾸지 않는다', async () => {
      dmsRepository.findOne.mockResolvedValue({ id: 30 });
      dmReadsRepository.findOne.mockResolvedValue({ lastReadId: 25 });
      await expect(service.markRead('shlack', 2, 20, 1)).resolves.toEqual({
        lastReadId: 25,
      });
      expect(dmReadsRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('DM 리액션/고정', () => {
    it('받은 DM 에도 리액션을 달 수 있고 두 사람에게 알린다', async () => {
      onlineMap['/ws-shlack'] = { socketA: 1, socketB: 2 };
      dmsRepository.findOne.mockResolvedValue({
        id: 5,
        SenderId: 2,
        ReceiverId: 1,
      });
      dmReactionsRepository.findOne.mockResolvedValue(null);
      dmReactionsRepository.find.mockResolvedValue([
        { id: 1, DMId: 5, UserId: 1, emoji: '👍' },
      ]);
      const result = await service.toggleReaction('shlack', 2, 5, '👍', 1);
      expect(dmReactionsRepository.save).toHaveBeenCalledWith({
        DMId: 5,
        UserId: 1,
        emoji: '👍',
      });
      expect(emit).toHaveBeenCalledWith('dmReactionUpdated', result);
    });

    it('이미 단 리액션을 다시 누르면 지운다', async () => {
      dmsRepository.findOne.mockResolvedValue({
        id: 5,
        SenderId: 1,
        ReceiverId: 2,
      });
      dmReactionsRepository.findOne.mockResolvedValue({ id: 9 });
      dmReactionsRepository.find.mockResolvedValue([]);
      await service.toggleReaction('shlack', 2, 5, '👍', 1);
      expect(dmReactionsRepository.delete).toHaveBeenCalledWith(9);
      expect(dmReactionsRepository.save).not.toHaveBeenCalled();
    });

    it('다른 사람끼리 나눈 DM 은 고정할 수 없다', async () => {
      dmsRepository.findOne.mockResolvedValue({
        id: 5,
        SenderId: 2,
        ReceiverId: 3,
      });
      await expect(
        service.setPinned('shlack', 2, 5, true, 1),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(dmsRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('DM 수정/삭제', () => {
    it('받은 DM 은 수정할 수 없다', async () => {
      dmsRepository.findOne.mockResolvedValue({
        id: 5,
        SenderId: 2,
        ReceiverId: 1,
      });
      await expect(
        service.editDM('shlack', 2, 5, '수정', 1),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('다른 사람끼리 나눈 DM 은 찾을 수 없다', async () => {
      dmsRepository.findOne.mockResolvedValue({
        id: 5,
        SenderId: 1,
        ReceiverId: 3,
      });
      await expect(service.deleteDM('shlack', 2, 5, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('보낸 DM 을 삭제하면 두 사람에게 dmDeleted 이벤트를 보낸다', async () => {
      onlineMap['/ws-shlack'] = { socketA: 1, socketB: 2 };
      dmsRepository.findOne.mockResolvedValue({
        id: 5,
        SenderId: 1,
        ReceiverId: 2,
      });

      await service.deleteDM('shlack', 2, 5, 1);

      expect(dmsRepository.delete).toHaveBeenCalledWith(5);
      expect(eventsGateway.server.to).toHaveBeenCalledWith([
        'socketB',
        'socketA',
      ]);
      expect(emit).toHaveBeenCalledWith('dmDeleted', {
        id: 5,
        SenderId: 1,
        ReceiverId: 2,
      });
    });
  });
});
