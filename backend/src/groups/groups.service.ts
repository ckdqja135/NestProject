import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserGroupMembers } from '../entities/UserGroupMembers';
import { UserGroups } from '../entities/UserGroups';
import { WorkspaceMembers } from '../entities/WorkspaceMembers';
import { EventsGateway } from '../events/events.gateway';
import {
  isAdminRole,
  WorkspacesService,
} from '../workspaces/workspaces.service';

// @channel, @here 와 헷갈리는 이름은 쓸 수 없다
const RESERVED = ['channel', 'here'];

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(UserGroups)
    private groupsRepository: Repository<UserGroups>,
    @InjectRepository(UserGroupMembers)
    private groupMembersRepository: Repository<UserGroupMembers>,
    @InjectRepository(WorkspaceMembers)
    private workspaceMembersRepository: Repository<WorkspaceMembers>,
    private workspacesService: WorkspacesService,
    private eventsGateway: EventsGateway,
  ) {}

  private async findWorkspace(url: string, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    const role = await this.workspacesService.assertMember(workspace.id, myId);
    return Object.assign(workspace, { role });
  }

  // 그룹 목록 (멤버 포함)
  async getGroups(url: string, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    return this.groupsRepository
      .createQueryBuilder('group')
      .leftJoinAndSelect('group.Members', 'member')
      .leftJoin('member.User', 'user')
      .addSelect(['user.id', 'user.nickname', 'user.email', 'user.avatarStyle'])
      .where('group.WorkspaceId = :workspaceId', { workspaceId: workspace.id })
      .orderBy('group.name', 'ASC')
      .getMany();
  }

  private async assertNameAvailable(
    workspaceId: number,
    name: string,
    exceptId?: number,
  ) {
    if (RESERVED.includes(name.toLowerCase())) {
      throw new BadRequestException('사용할 수 없는 그룹 이름입니다.');
    }
    const exists = await this.groupsRepository.findOne({
      where: { WorkspaceId: workspaceId, name },
    });
    if (exists && exists.id !== exceptId) {
      throw new ForbiddenException('이미 있는 그룹 이름입니다.');
    }
  }

  // 워크스페이스 멤버만 그룹에 넣을 수 있다
  private async filterWorkspaceMembers(workspaceId: number, ids: number[]) {
    if (!ids.length) {
      return [];
    }
    const members = await this.workspaceMembersRepository.find({
      where: { WorkspaceId: workspaceId, UserId: In([...new Set(ids)]) },
      select: ['UserId'],
    });
    return members.map((m) => m.UserId);
  }

  private async setMembers(groupId: number, userIds: number[]) {
    await this.groupMembersRepository.delete({ GroupId: groupId });
    if (userIds.length) {
      await this.groupMembersRepository.save(
        userIds.map((UserId) => ({ GroupId: groupId, UserId })),
      );
    }
  }

  async createGroup(
    url: string,
    dto: { name: string; description?: string; memberIds?: number[] },
    myId: number,
  ) {
    const workspace = await this.findWorkspace(url, myId);
    if (workspace.role === 'guest') {
      throw new ForbiddenException('게스트는 그룹을 만들 수 없습니다.');
    }
    const name = dto.name.trim();
    await this.assertNameAvailable(workspace.id, name);
    const group = await this.groupsRepository.save({
      WorkspaceId: workspace.id,
      name,
      description: dto.description?.trim() || null,
      CreatorId: myId,
    });
    await this.setMembers(
      group.id,
      await this.filterWorkspaceMembers(workspace.id, dto.memberIds || [myId]),
    );
    this.eventsGateway.emitToWorkspace(url, 'groupsChanged');
    return group;
  }

  // 이름·설명·멤버 변경과 삭제는 만든 사람과 워크스페이스 관리자만
  private async findManageableGroup(url: string, id: number, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    const group = await this.groupsRepository.findOne({
      where: { id, WorkspaceId: workspace.id },
    });
    if (!group) {
      throw new NotFoundException('존재하지 않는 그룹입니다.');
    }
    if (group.CreatorId !== myId && !isAdminRole(workspace.role)) {
      throw new ForbiddenException(
        '그룹을 만든 사람이나 워크스페이스 관리자만 할 수 있습니다.',
      );
    }
    return { workspace, group };
  }

  async updateGroup(
    url: string,
    id: number,
    dto: { name?: string; description?: string; memberIds?: number[] },
    myId: number,
  ) {
    const { workspace, group } = await this.findManageableGroup(url, id, myId);
    const update: Partial<UserGroups> = {};
    if (dto.name !== undefined && dto.name.trim() !== group.name) {
      await this.assertNameAvailable(workspace.id, dto.name.trim(), group.id);
      update.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      update.description = dto.description.trim() || null;
    }
    if (Object.keys(update).length) {
      await this.groupsRepository.update(group.id, update);
    }
    if (dto.memberIds) {
      await this.setMembers(
        group.id,
        await this.filterWorkspaceMembers(workspace.id, dto.memberIds),
      );
    }
    this.eventsGateway.emitToWorkspace(url, 'groupsChanged');
    return this.groupsRepository.findOne({ where: { id: group.id } });
  }

  async deleteGroup(url: string, id: number, myId: number) {
    const { group } = await this.findManageableGroup(url, id, myId);
    await this.groupsRepository.delete(group.id);
    this.eventsGateway.emitToWorkspace(url, 'groupsChanged');
  }

  // 그룹 참여/나가기는 누구나 스스로 할 수 있다
  async setMyMembership(url: string, id: number, join: boolean, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    const group = await this.groupsRepository.findOne({
      where: { id, WorkspaceId: workspace.id },
    });
    if (!group) {
      throw new NotFoundException('존재하지 않는 그룹입니다.');
    }
    if (join) {
      await this.groupMembersRepository.save({ GroupId: id, UserId: myId });
    } else {
      await this.groupMembersRepository.delete({ GroupId: id, UserId: myId });
    }
    this.eventsGateway.emitToWorkspace(url, 'groupsChanged');
  }
}
