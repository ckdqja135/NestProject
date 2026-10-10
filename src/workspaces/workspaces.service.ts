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

  async assertMember(workspaceId: number, userId: number) {
    const member = await this.workspaceMembersRepository.findOne({
      where: { WorkspaceId: workspaceId, UserId: userId },
    });
    if (!member) {
      throw new ForbiddenException('워크스페이스 멤버가 아닙니다.');
    }
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
      return workspace;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getWorkspaceMembers(url: string, myId: number) {
    const workspace = await this.findWorkspaceByUrl(url);
    await this.assertMember(workspace.id, myId);
    return this.usersRepository
      .createQueryBuilder('user')
      .innerJoin('user.WorkspaceMembers', 'members')
      .where('members.WorkspaceId = :workspaceId', {
        workspaceId: workspace.id,
      })
      .orderBy('user.nickname', 'ASC')
      .getMany();
  }

  async inviteMember(url: string, email: string, myId: number) {
    const workspace = await this.findWorkspaceByUrl(url);
    await this.assertMember(workspace.id, myId);
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
    });
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
    // 초대받은 사람의 화면(다른 워크스페이스에 접속 중이어도)에 워크스페이스 목록 갱신을 알리고,
    // 기존 멤버들의 멤버 목록(DM 목록)도 갱신한다
    this.eventsGateway.notifyWorkspacesChanged(user.id);
    this.eventsGateway.emitToWorkspace(url, 'membersChanged');
  }

  async kickMember(url: string, targetId: number, myId: number) {
    const workspace = await this.findWorkspaceByUrl(url);
    // 본인 탈퇴 또는 워크스페이스 소유자의 강퇴만 허용
    if (targetId !== myId && workspace.OwnerId !== myId) {
      throw new ForbiddenException('멤버를 내보낼 권한이 없습니다.');
    }
    if (targetId === workspace.OwnerId) {
      throw new BadRequestException('워크스페이스 소유자는 나갈 수 없습니다.');
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
    this.eventsGateway.emitToWorkspace(url, 'membersChanged');
  }

  async getWorkspaceMember(url: string, id: number, myId: number) {
    const workspace = await this.findWorkspaceByUrl(url);
    await this.assertMember(workspace.id, myId);
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .innerJoin('user.WorkspaceMembers', 'members', 'members.WorkspaceId = :workspaceId', {
        workspaceId: workspace.id,
      })
      .where('user.id = :id', { id })
      .getOne();
    if (!user) {
      throw new NotFoundException('워크스페이스에 존재하지 않는 사용자입니다.');
    }
    return user;
  }
}
