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
import { WorkspacesService } from './workspaces.service';

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  const workspacesRepository = { findOne: jest.fn(), find: jest.fn() };
  const workspaceMembersRepository = { findOne: jest.fn(), delete: jest.fn() };
  const channelsRepository = { find: jest.fn() };
  const channelMembersRepository = { delete: jest.fn() };

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

  describe('kickMember', () => {
    beforeEach(() => {
      workspacesRepository.findOne.mockResolvedValue({ id: 1, OwnerId: 10 });
    });

    it('소유자가 아닌 사람이 다른 멤버를 내보내면 ForbiddenException', async () => {
      await expect(service.kickMember('sleact', 3, 2)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('소유자는 워크스페이스를 나갈 수 없다', async () => {
      await expect(service.kickMember('sleact', 10, 10)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('본인 탈퇴 시 워크스페이스와 모든 채널 멤버에서 제거한다', async () => {
      channelsRepository.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      await service.kickMember('sleact', 2, 2);
      expect(workspaceMembersRepository.delete).toHaveBeenCalledWith({
        WorkspaceId: 1,
        UserId: 2,
      });
      expect(channelMembersRepository.delete).toHaveBeenCalledTimes(2);
    });
  });
});
