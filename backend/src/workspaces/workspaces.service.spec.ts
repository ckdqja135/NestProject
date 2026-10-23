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
import { BotsService } from '../bots/bots.service';
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
    update: jest.fn(),
    save: jest.fn(),
  };
  const channelsRepository = { find: jest.fn(), findOne: jest.fn() };
  const channelMembersRepository = { delete: jest.fn(), save: jest.fn() };
  const usersRepository = { findOne: jest.fn() };
  const dataSource = { query: jest.fn() };
  // 멤버 표: 사용자 id → 역할 (10 번이 소유자)
  let roles: Record<number, string> = {};
  const memberRow = ({ where }: { where: { UserId: number } }) =>
    Promise.resolve(
      roles[where.UserId]
        ? {
            UserId: where.UserId,
            role: roles[where.UserId],
            Workspace: { OwnerId: 10 },
          }
        : null,
    );
  const eventsGateway = {
    removeUserFromWorkspace: jest.fn(),
    notifyWorkspacesChanged: jest.fn(),
    emitToWorkspace: jest.fn(),
    memberAccessChanged: jest.fn(),
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
        { provide: getRepositoryToken(Users), useValue: usersRepository },
        { provide: DataSource, useValue: dataSource },
        { provide: EventsGateway, useValue: eventsGateway },
        {
          provide: BotsService,
          useValue: {
            isBot: jest.fn().mockResolvedValue(false),
            ensureMember: jest.fn().mockResolvedValue(77),
          },
        },
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
      roles = {
        10: 'member',
        2: 'member',
        3: 'member',
        4: 'admin',
        5: 'admin',
      };
      workspaceMembersRepository.findOne.mockImplementation(memberRow);
    });

    it('관리자는 멤버를 내보낼 수 있지만 다른 관리자는 소유자만 내보낸다', async () => {
      channelsRepository.find.mockResolvedValue([]);
      await service.kickMember('shlack', 3, 4);
      expect(workspaceMembersRepository.delete).toHaveBeenCalledWith({
        WorkspaceId: 1,
        UserId: 3,
      });
      await expect(service.kickMember('shlack', 5, 4)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await service.kickMember('shlack', 5, 10);
      expect(workspaceMembersRepository.delete).toHaveBeenCalledWith({
        WorkspaceId: 1,
        UserId: 5,
      });
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
      // 열어 둔 문서 공동 편집에서도 나가게 한다
      expect(eventsGateway.memberAccessChanged).toHaveBeenCalledWith(
        'shlack',
        2,
      );
    });

    it('권한이 없어 실패하면 소켓은 건드리지 않는다', async () => {
      await expect(service.kickMember('shlack', 3, 2)).rejects.toThrow();
      expect(eventsGateway.removeUserFromWorkspace).not.toHaveBeenCalled();
    });
  });

  describe('역할', () => {
    beforeEach(() => {
      workspacesRepository.findOne.mockResolvedValue({
        id: 1,
        url: 'shlack',
        OwnerId: 10,
      });
      roles = { 10: 'member', 2: 'member', 3: 'guest', 4: 'admin', 5: 'admin' };
      workspaceMembersRepository.findOne.mockImplementation(memberRow);
    });

    it('소유자는 관리자를 지정하고, 관리자는 멤버↔게스트만 바꾼다', async () => {
      await service.setMemberRole('shlack', 2, 'admin', 10);
      expect(workspaceMembersRepository.update).toHaveBeenCalledWith(
        { WorkspaceId: 1, UserId: 2 },
        { role: 'admin' },
      );
      await service.setMemberRole('shlack', 2, 'guest', 4);
      expect(workspaceMembersRepository.update).toHaveBeenLastCalledWith(
        { WorkspaceId: 1, UserId: 2 },
        { role: 'guest' },
      );
      await expect(
        service.setMemberRole('shlack', 2, 'admin', 4),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.setMemberRole('shlack', 5, 'member', 4),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.setMemberRole('shlack', 3, 'member', 2),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.setMemberRole('shlack', 10, 'member', 4),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('게스트 초대는 관리자만, 고른 채널에만 넣는다', async () => {
      usersRepository.findOne.mockResolvedValue({ id: 7 });
      channelsRepository.find.mockResolvedValue([
        { id: 3, WorkspaceId: 1, archived: false },
      ]);
      await expect(
        service.inviteMember('shlack', 'g@g.com', 2, 'guest', [3]),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.inviteMember('shlack', 'g@g.com', 4, 'guest', []),
      ).rejects.toBeInstanceOf(BadRequestException);
      await service.inviteMember('shlack', 'g@g.com', 4, 'guest', [3]);
      expect(workspaceMembersRepository.save).toHaveBeenCalledWith({
        WorkspaceId: 1,
        UserId: 7,
        role: 'guest',
      });
      expect(channelMembersRepository.save).toHaveBeenCalledWith({
        ChannelId: 3,
        UserId: 7,
      });
      expect(channelsRepository.findOne).not.toHaveBeenCalled();
    });

    it('게스트는 사람을 초대할 수 없다', async () => {
      await expect(
        service.inviteMember('shlack', 'x@x.com', 3),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
