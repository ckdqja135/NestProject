import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DMs } from '../entities/DMs';
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
        DmsService,
        { provide: getRepositoryToken(DMs), useValue: dmsRepository },
        { provide: WorkspacesService, useValue: workspacesService },
        { provide: EventsGateway, useValue: eventsGateway },
      ],
    }).compile();

    service = module.get<DmsService>(DmsService);
    workspacesService.findWorkspaceByUrl.mockResolvedValue({ id: 1 });
  });

  afterEach(() => {
    delete onlineMap['/ws-sleact'];
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('DM 저장 후 받는 사람과 보낸 사람의 소켓으로 dm 이벤트를 보낸다', async () => {
    onlineMap['/ws-sleact'] = { socketA: 1, socketB: 2, socketC: 3 };
    dmsRepository.save.mockResolvedValue({ id: 5 });
    const dm = { id: 5, content: '안녕', SenderId: 1, ReceiverId: 2 };
    dmsRepository.findOne.mockResolvedValue(dm);

    await service.createWorkspaceDMChats('sleact', '안녕', 2, 1);

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

    await service.createWorkspaceDMChats('sleact', '안녕', 2, 1);

    expect(eventsGateway.server.to).not.toHaveBeenCalled();
  });

  describe('DM 수정/삭제', () => {
    it('받은 DM 은 수정할 수 없다', async () => {
      dmsRepository.findOne.mockResolvedValue({
        id: 5,
        SenderId: 2,
        ReceiverId: 1,
      });
      await expect(
        service.editDM('sleact', 2, 5, '수정', 1),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('다른 사람끼리 나눈 DM 은 찾을 수 없다', async () => {
      dmsRepository.findOne.mockResolvedValue({
        id: 5,
        SenderId: 1,
        ReceiverId: 3,
      });
      await expect(service.deleteDM('sleact', 2, 5, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('보낸 DM 을 삭제하면 두 사람에게 dmDeleted 이벤트를 보낸다', async () => {
      onlineMap['/ws-sleact'] = { socketA: 1, socketB: 2 };
      dmsRepository.findOne.mockResolvedValue({
        id: 5,
        SenderId: 1,
        ReceiverId: 2,
      });

      await service.deleteDM('sleact', 2, 5, 1);

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
