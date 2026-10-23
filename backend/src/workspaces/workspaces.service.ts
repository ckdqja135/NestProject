import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Workspaces } from '../entities/Workspaces';
import { Channels } from '../entities/Channels';
import { WorkspaceMembers } from '../entities/WorkspaceMembers';
import { ChannelMembers } from '../entities/ChannelMembers';
import { Users } from '../entities/Users';
import { EventsGateway } from '../events/events.gateway';
import { BotsService } from '../bots/bots.service';
import { MemberRole } from './dto/member-role.dto';

// 워크스페이스 안에서의 역할. 소유자는 Workspaces.OwnerId, 나머지는 멤버 표의 role 칸
export type WorkspaceRole = 'owner' | MemberRole;
const RANK: Record<WorkspaceRole, number> = {
  guest: 0,
  member: 1,
  admin: 2,
  owner: 3,
};
export const isAdminRole = (role: WorkspaceRole | null | undefined) =>
  role === 'owner' || role === 'admin';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectRepository(Workspaces)
    private workspacesRepository: Repository<Workspaces>,
    @InjectRepository(WorkspaceMembers)
    private workspaceMembersRepository: Repository<WorkspaceMembers>,
    @InjectRepository(Channels)
    private channelsRepository: Repository<Channels>,
    @InjectRepository(ChannelMembers)
    private channelMembersRepository: Repository<ChannelMembers>,
    @InjectRepository(Users)
    private usersRepository: Repository<Users>,
    private dataSource: DataSource,
    private eventsGateway: EventsGateway,
    private botsService: BotsService,
  ) {}

  async findWorkspaceByUrl(url: string) {
    const workspace = await this.workspacesRepository.findOne({
      where: { url },
    });
    if (!workspace) {
      throw new NotFoundException('존재하지 않는 워크스페이스입니다.');
    }
    return workspace;
  }

  // 이 워크스페이스에서의 역할 (멤버가 아니면 null)
  async roleOf(
    workspaceId: number,
    userId: number,
  ): Promise<WorkspaceRole | null> {
    const member = await this.workspaceMembersRepository.findOne({
      where: { WorkspaceId: workspaceId, UserId: userId },
      relations: ['Workspace'],
    });
    if (!member) {
      return null;
    }
    if (member.Workspace?.OwnerId === userId) {
      return 'owner';
    }
    return member.role || 'member';
  }

  // 멤버인지 확인하고 역할을 돌려준다
  async assertMember(
    workspaceId: number,
    userId: number,
  ): Promise<WorkspaceRole> {
    const role = await this.roleOf(workspaceId, userId);
    if (!role) {
      throw new ForbiddenException('워크스페이스 멤버가 아닙니다.');
    }
    return role;
  }

  // 이 역할 이상인지 확인한다 (게스트 < 멤버 < 관리자 < 소유자)
  async assertRole(
    workspaceId: number,
    userId: number,
    minimum: WorkspaceRole,
    message = '권한이 없습니다.',
  ) {
    const role = await this.assertMember(workspaceId, userId);
    if (RANK[role] < RANK[minimum]) {
      throw new ForbiddenException(message);
    }
    return role;
  }

  // 게스트에게 보이는 사람: 같은 채널에 있는 사람, 먼저 DM 을 보낸 사람, 봇 (나머지 역할은 모두 보인다)
  async visibleMemberIds(workspaceId: number, guestId: number) {
    const rows: { id: number }[] = await this.dataSource.query(
      `SELECT DISTINCT cm2.UserId AS id
         FROM channelmembers cm1
         JOIN channels c ON c.id = cm1.ChannelId AND c.WorkspaceId = ?
         JOIN channelmembers cm2 ON cm2.ChannelId = cm1.ChannelId
        WHERE cm1.UserId = ?
       UNION
       SELECT d.SenderId FROM dms d
        WHERE d.WorkspaceId = ? AND d.ReceiverId = ? AND d.SenderId IS NOT NULL
       UNION
       SELECT u.id FROM users u
         JOIN workspacemembers wm ON wm.UserId = u.id AND wm.WorkspaceId = ?
        WHERE u.bot = 1`,
      [workspaceId, guestId, workspaceId, guestId, workspaceId],
    );
    return new Set([guestId, ...rows.map((r) => Number(r.id))]);
  }

  async findMyWorkspaces(myId: number) {
    return this.workspacesRepository.find({
      where: { WorkspaceMembers: { UserId: myId } },
    });
  }

  async createWorkspace(name: string, url: string, myId: number) {
    const exists = await this.workspacesRepository.findOne({
      where: [{ name }, { url }],
      withDeleted: true,
    });
    if (exists) {
      throw new ForbiddenException(
        '이미 사용중인 워크스페이스 이름 또는 url 입니다.',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const workspace = await queryRunner.manager
        .getRepository(Workspaces)
        .save({ name, url, OwnerId: myId });
      await queryRunner.manager
        .getRepository(WorkspaceMembers)
        .save({ UserId: myId, WorkspaceId: workspace.id });
      const channel = await queryRunner.manager
        .getRepository(Channels)
        .save({ name: '일반', WorkspaceId: workspace.id });
      await queryRunner.manager
        .getRepository(ChannelMembers)
        .save({ UserId: myId, ChannelId: channel.id });
      await queryRunner.commitTransaction();
      // 슐랙봇도 멤버로 (알림 DM 을 받을 수 있게)
      await this.botsService.ensureMember(workspace.id).catch(() => undefined);
      return workspace;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // 멤버 목록 (역할 포함). 게스트에게는 같은 채널에 있는 사람만 보인다
  async getWorkspaceMembers(url: string, myId: number) {
    const workspace = await this.findWorkspaceByUrl(url);
    const myRole = await this.assertMember(workspace.id, myId);
    const users = await this.usersRepository
      .createQueryBuilder('user')
      .innerJoin('user.WorkspaceMembers', 'members')
      .where('members.WorkspaceId = :workspaceId', {
        workspaceId: workspace.id,
      })
      .orderBy('user.nickname', 'ASC')
      .getMany();
    const rows = await this.workspaceMembersRepository.find({
      where: { WorkspaceId: workspace.id },
      select: ['UserId', 'role'],
    });
    const roles = new Map(rows.map((r) => [r.UserId, r.role || 'member']));
    const visible =
      myRole === 'guest'
        ? await this.visibleMemberIds(workspace.id, myId)
        : null;
    return users
      .filter((u) => !visible || visible.has(u.id))
      .map((u) => ({
        ...u,
        role: (u.id === workspace.OwnerId
          ? 'owner'
          : roles.get(u.id) || 'member') as WorkspaceRole,
      }));
  }

  async inviteMember(
    url: string,
    email: string,
    myId: number,
    role: 'member' | 'guest' = 'member',
    channelIds: number[] = [],
  ) {
    const workspace = await this.findWorkspaceByUrl(url);
    const myRole = await this.assertMember(workspace.id, myId);
    if (myRole === 'guest') {
      throw new ForbiddenException('게스트는 사람을 초대할 수 없습니다.');
    }
    if (role === 'guest' && !isAdminRole(myRole)) {
      throw new ForbiddenException('게스트 초대는 관리자만 할 수 있습니다.');
    }
    // 게스트는 고른 채널에만 들어간다
    let guestChannels: Channels[] = [];
    if (role === 'guest') {
      const ids = [...new Set(channelIds)];
      if (!ids.length) {
        throw new BadRequestException('게스트가 들어갈 채널을 골라 주세요.');
      }
      guestChannels = await this.channelsRepository.find({
        where: ids.map((id) => ({ id, WorkspaceId: workspace.id })),
      });
      if (
        guestChannels.length !== ids.length ||
        guestChannels.some((c) => c.archived)
      ) {
        throw new BadRequestException('고른 채널을 찾을 수 없습니다.');
      }
    }
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('존재하지 않는 사용자입니다.');
    }
    const already = await this.workspaceMembersRepository.findOne({
      where: { WorkspaceId: workspace.id, UserId: user.id },
    });
    if (already) {
      throw new ForbiddenException('이미 워크스페이스 멤버입니다.');
    }

    await this.workspaceMembersRepository.save({
      WorkspaceId: workspace.id,
      UserId: user.id,
      role,
    });
    if (role === 'guest') {
      for (const channel of guestChannels) {
        await this.channelMembersRepository.save({
          ChannelId: channel.id,
          UserId: user.id,
        });
      }
    } else {
      // 초대받은 사람은 워크스페이스의 '일반' 채널에도 자동 참여
      const channel = await this.channelsRepository.findOne({
        where: { WorkspaceId: workspace.id, name: '일반' },
      });
      if (channel) {
        await this.channelMembersRepository.save({
          ChannelId: channel.id,
          UserId: user.id,
        });
      }
    }
    // 초대받은 사람의 화면(다른 워크스페이스에 접속 중이어도)에 워크스페이스 목록 갱신을 알리고,
    // 기존 멤버들의 멤버 목록(DM 목록)도 갱신한다
    this.eventsGateway.notifyWorkspacesChanged(user.id);
    this.eventsGateway.emitToWorkspace(url, 'membersChanged');
  }

  async kickMember(url: string, targetId: number, myId: number) {
    const workspace = await this.findWorkspaceByUrl(url);
    // 본인 탈퇴, 또는 관리자가 멤버·게스트를 (소유자는 관리자도) 내보낸다
    const myRole = await this.assertMember(workspace.id, myId);
    if (targetId === workspace.OwnerId) {
      throw new BadRequestException('워크스페이스 소유자는 나갈 수 없습니다.');
    }
    if (targetId !== myId) {
      if (!isAdminRole(myRole)) {
        throw new ForbiddenException('멤버를 내보낼 권한이 없습니다.');
      }
      const targetRole = await this.roleOf(workspace.id, targetId);
      if (!targetRole) {
        throw new NotFoundException(
          '워크스페이스에 존재하지 않는 사용자입니다.',
        );
      }
      if (targetRole === 'admin' && myRole !== 'owner') {
        throw new ForbiddenException('관리자는 소유자만 내보낼 수 있습니다.');
      }
    }
    await this.workspaceMembersRepository.delete({
      WorkspaceId: workspace.id,
      UserId: targetId,
    });
    const channels = await this.channelsRepository.find({
      where: { WorkspaceId: workspace.id },
      select: ['id'],
    });
    for (const channel of channels) {
      await this.channelMembersRepository.delete({
        ChannelId: channel.id,
        UserId: targetId,
      });
    }
    // 내보낸 사람의 소켓 연결을 끊어 이 워크스페이스 메시지를 더 받지 못하게 하고, 남은 멤버들에게 알린다
    this.eventsGateway.removeUserFromWorkspace(
      url,
      targetId,
      targetId === myId ? 'left' : 'kicked',
    );
    // 열어 둔 문서 공동 편집에서도 바로 나가게 한다
    this.eventsGateway.memberAccessChanged(url, targetId);
    this.eventsGateway.emitToWorkspace(url, 'membersChanged');
  }

  private async findOwnedWorkspace(url: string, myId: number) {
    const workspace = await this.findWorkspaceByUrl(url);
    if (workspace.OwnerId !== myId) {
      throw new ForbiddenException('워크스페이스 소유자만 할 수 있습니다.');
    }
    return workspace;
  }

  // 워크스페이스 이름/주소 변경 (소유자만)
  async updateWorkspace(
    url: string,
    changes: { name?: string; url?: string },
    myId: number,
  ) {
    const workspace = await this.findOwnedWorkspace(url, myId);
    const update: Partial<Workspaces> = {};
    const name = changes.name?.trim();
    if (name && name !== workspace.name) {
      const exists = await this.workspacesRepository.findOne({
        where: { name },
        withDeleted: true,
      });
      if (exists) {
        throw new ForbiddenException('이미 사용중인 워크스페이스 이름입니다.');
      }
      update.name = name;
    }
    if (changes.url && changes.url !== workspace.url) {
      const exists = await this.workspacesRepository.findOne({
        where: { url: changes.url },
        withDeleted: true,
      });
      if (exists) {
        throw new ForbiddenException('이미 사용중인 워크스페이스 url 입니다.');
      }
      update.url = changes.url;
    }
    if (Object.keys(update).length) {
      await this.workspacesRepository.update(workspace.id, update);
    }
    const updated = await this.workspacesRepository.findOne({
      where: { id: workspace.id },
    });
    await this.notifyWorkspaceUpdated(url, updated);
    return updated;
  }

  // 역할 바꾸기: 소유자는 관리자·멤버·게스트 모두, 관리자는 멤버↔게스트만
  async setMemberRole(
    url: string,
    targetId: number,
    role: MemberRole,
    myId: number,
  ) {
    const workspace = await this.findWorkspaceByUrl(url);
    const myRole = await this.assertMember(workspace.id, myId);
    if (!isAdminRole(myRole)) {
      throw new ForbiddenException('관리자만 역할을 바꿀 수 있습니다.');
    }
    if (targetId === myId) {
      throw new BadRequestException('내 역할은 바꿀 수 없습니다.');
    }
    const targetRole = await this.roleOf(workspace.id, targetId);
    if (!targetRole) {
      throw new NotFoundException('워크스페이스에 존재하지 않는 사용자입니다.');
    }
    if (targetRole === 'owner') {
      throw new BadRequestException(
        '소유자의 역할은 바꿀 수 없습니다. 소유권 넘기기를 쓰세요.',
      );
    }
    if (myRole !== 'owner' && (role === 'admin' || targetRole === 'admin')) {
      throw new ForbiddenException(
        '관리자 지정·해제는 소유자만 할 수 있습니다.',
      );
    }
    if (await this.botsService.isBot(targetId)) {
      throw new BadRequestException('봇의 역할은 바꿀 수 없습니다.');
    }
    await this.workspaceMembersRepository.update(
      { WorkspaceId: workspace.id, UserId: targetId },
      { role },
    );
    this.eventsGateway.emitToWorkspace(url, 'membersChanged');
    // 게스트가 되면 공개 문서를 더 볼 수 없다: 열어 둔 문서 권한을 바로 다시 계산한다
    this.eventsGateway.memberAccessChanged(url, targetId);
    return { id: targetId, role };
  }

  // 소유권 넘기기 (소유자만, 워크스페이스 멤버에게)
  async transferOwnership(url: string, targetId: number, myId: number) {
    const workspace = await this.findOwnedWorkspace(url, myId);
    if (targetId === myId) {
      throw new BadRequestException('이미 소유자입니다.');
    }
    const targetRole = await this.assertMember(workspace.id, targetId);
    if (targetRole === 'guest') {
      throw new BadRequestException('게스트에게는 소유권을 넘길 수 없습니다.');
    }
    await this.workspacesRepository.update(workspace.id, { OwnerId: targetId });
    // 넘겨준 사람은 관리자로 남는다
    await this.workspaceMembersRepository.update(
      { WorkspaceId: workspace.id, UserId: myId },
      { role: 'admin' },
    );
    const updated = await this.workspacesRepository.findOne({
      where: { id: workspace.id },
    });
    await this.notifyWorkspaceUpdated(url, updated);
    this.eventsGateway.emitToWorkspace(url, 'membersChanged');
    return updated;
  }

  // 접속 중인 멤버들에게 알린다. 주소가 바뀌면 옛 주소로 접속한 화면이 새 주소로 옮겨 간다.
  private async notifyWorkspaceUpdated(oldUrl: string, workspace: Workspaces) {
    this.eventsGateway.emitToWorkspace(oldUrl, 'workspaceUpdated', {
      ...workspace,
      oldUrl,
    });
    // 다른 워크스페이스를 보고 있는 멤버의 워크스페이스 목록도 갱신
    const members = await this.workspaceMembersRepository.find({
      where: { WorkspaceId: workspace.id },
      select: ['UserId'],
    });
    members.forEach(({ UserId }) =>
      this.eventsGateway.notifyWorkspacesChanged(UserId),
    );
  }

  async getWorkspaceMember(url: string, id: number, myId: number) {
    const workspace = await this.findWorkspaceByUrl(url);
    const myRole = await this.assertMember(workspace.id, myId);
    if (
      myRole === 'guest' &&
      !(await this.visibleMemberIds(workspace.id, myId)).has(id)
    ) {
      throw new NotFoundException('워크스페이스에 존재하지 않는 사용자입니다.');
    }
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .innerJoin(
        'user.WorkspaceMembers',
        'members',
        'members.WorkspaceId = :workspaceId',
        {
          workspaceId: workspace.id,
        },
      )
      .where('user.id = :id', { id })
      .getOne();
    if (!user) {
      throw new NotFoundException('워크스페이스에 존재하지 않는 사용자입니다.');
    }
    return user;
  }
}
