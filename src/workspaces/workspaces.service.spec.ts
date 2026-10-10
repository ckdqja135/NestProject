import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ChannelMembers } from '../entities/ChannelMembers';
import { Channels } from '../entities/Channels';
import { Users } from '../entities/Users';
import { WorkspaceMembers } from '../entities/WorkspaceMembers';
import { Workspaces } from '../entities/Workspaces';
import { EventsGateway } from '../events/events.gateway';
import { WorkspacesService } from './workspaces.service';

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  const workspacesRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };
  const workspaceMembersRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };
  const channelsRepository = { find: jest.fn() };
  const channelMembersRepository = { delete: jest.fn() };
  const eventsGateway = {
    removeUserFromWorkspace: jest.fn(),
    notifyWorkspacesChanged: jest.fn(),
    emitToWorkspace: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        {
          provide: getRepositoryToken(Workspaces),
          useValue: workspacesRepository,
        },
        {
          provide: getRepositoryToken(WorkspaceMembers),
          useValue: workspaceMembersRepository,
        },
        { provide: getRepositoryToken(Channels), useValue: channelsRepository },
        {
          provide: getRepositoryToken(ChannelMembers),
          useValue: channelMembersRepository,
        },
        { provide: getRepositoryToken(Users), useValue: {} },
        { provide: DataSource, useValue: {} },
        { provide: EventsGateway, useValue: eventsGateway },
      ],
    }).compile();

    service = module.get<WorkspacesService>(WorkspacesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('없는 워크스페이스 url 이면 NotFoundException', async () => {
    workspacesRepository.findOne.mockResolvedValue(null);
    await expect(service.findWorkspaceByUrl('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('워크스페이스 멤버가 아니면 ForbiddenException', async () => {
    workspaceMembersRepository.findOne.mockResolvedValue(null);
    await expect(service.assertMember(1, 2)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  describe('워크스페이스 설정', () => {
    const workspace = { id: 1, name: '슐랙', url: 'shlack', OwnerId: 1 };

    it('소유자가 아니면 바꿀 수 없다', async () => {
      workspacesRepository.findOne.mockResolvedValue(workspace);
      await expect(
        service.updateWorkspace('shlack', { name: '새이름' }, 2),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(workspacesRepository.update).not.toHaveBeenCalled();
    });

    it('이미 쓰는 url 로는 바꿀 수 없다', async () => {
      workspacesRepository.findOne
        .mockResolvedValueOnce(workspace)
        .mockResolvedValueOnce({ id: 2, url: 'taken' });
      await expect(
        service.updateWorkspace('shlack', { url: 'taken' }, 1),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('url 을 바꾸면 옛 주소로 접속한 멤버들에게 알린다', async () => {
      const updated = { ...workspace, url: 'new-url' };
      workspacesRepository.findOne
        .mockResolvedValueOnce(workspace)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(updated);
      workspaceMembersRepository.find.mockResolvedValue([
        { UserId: 1 },
        { UserId: 2 },
      ]);
      await service.updateWorkspace('shlack', { url: 'new-url' }, 1);
      expect(workspacesRepository.update).toHaveBeenCalledWith(1, {
        url: 'new-url',
      });
      expect(eventsGateway.emitToWorkspace).toHaveBeenCalledWith(
        'shlack',
        'workspaceUpdated',
        { ...updated, oldUrl: 'shlack' },
      );
      expect(eventsGateway.notifyWorkspacesChanged).toHaveBeenCalledTimes(2);
    });

    it('소유권은 워크스페이스 멤버에게만 넘길 수 있다', async () => {
      workspacesRepository.findOne.mockResolvedValue(workspace);
      workspaceMembersRepository.findOne.mockResolvedValue(null);
      await expect(
        service.transferOwnership('shlack', 3, 1),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(workspacesRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('kickMember', () => {
    beforeEach(() => {
      workspacesRepository.findOne.mockResolvedValue({ id: 1, OwnerId: 10 });
    });

    it('소유자가 아닌 사람이 다른 멤버를 내보내면 ForbiddenException', async () => {
      await expect(service.kickMember('shlack', 3, 2)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('소유자는 워크스페이스를 나갈 수 없다', async () => {
      await expect(service.kickMember('shlack', 10, 10)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('스스로 나가면 사유를 left 로 알린다', async () => {
      channelsRepository.find.mockResolvedValue([]);
      await service.kickMember('shlack', 2, 2);
      expect(eventsGateway.removeUserFromWorkspace).toHaveBeenCalledWith(
        'shlack',
        2,
        'left',
      );
    });

    it('본인 탈퇴 시 워크스페이스와 모든 채널 멤버에서 제거한다', async () => {
      channelsRepository.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      await service.kickMember('shlack', 2, 2);
      expect(workspaceMembersRepository.delete).toHaveBeenCalledWith({
        WorkspaceId: 1,
        UserId: 2,
      });
      expect(channelMembersRepository.delete).toHaveBeenCalledTimes(2);
    });

    it('내보낸 사람의 소켓 연결을 끊는다', async () => {
      channelsRepository.find.mockResolvedValue([]);
      await service.kickMember('shlack', 2, 10);
      expect(eventsGateway.removeUserFromWorkspace).toHaveBeenCalledWith(
        'shlack',
        2,
        'kicked',
      );
      expect(eventsGateway.emitToWorkspace).toHaveBeenCalledWith(
        'shlack',
        'membersChanged',
      );
    });

    it('권한이 없어 실패하면 소켓은 건드리지 않는다', async () => {
      await expect(service.kickMember('shlack', 3, 2)).rejects.toThrow();
      expect(eventsGateway.removeUserFromWorkspace).not.toHaveBeenCalled();
    });
  });
});
