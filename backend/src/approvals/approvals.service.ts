import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BotsService } from '../bots/bots.service';
import { ChannelsService } from '../channels/channels.service';
import { DmsService } from '../dms/dms.service';
import { ApprovalSteps } from '../entities/ApprovalSteps';
import { Approvals } from '../entities/Approvals';
import { ChannelMembers } from '../entities/ChannelMembers';
import { Channels } from '../entities/Channels';
import { Users } from '../entities/Users';
import { EventsGateway } from '../events/events.gateway';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { CreateApprovalDto } from './dto/approval.dto';

// 채팅 메시지 내용: approval:{"id":12,"t":"제목","n":"카드 위에 보일 한 줄"}
export const toApprovalContent = (id: number, title: string, note?: string) =>
  `approval:${JSON.stringify(
    note ? { id, t: title, n: note } : { id, t: title },
  )}`;

const KIND_LABELS: Record<string, string> = {
  general: '결재',
  leave: '휴가 신청',
  expense: '지출 결의',
  purchase: '구매 요청',
};

const userView = (u?: Users | null) =>
  u
    ? {
        id: u.id,
        nickname: u.nickname,
        email: u.email,
        avatarStyle: u.avatarStyle,
      }
    : null;

// 결재: 채팅에 카드로 요청하고, 결재자가 순서대로 승인·반려한다. 차례가 오면 봇이 DM 으로 카드를 보낸다
@Injectable()
export class ApprovalsService {
  private logger = new Logger('Approvals');

  constructor(
    @InjectRepository(Approvals)
    private approvalsRepository: Repository<Approvals>,
    @InjectRepository(ApprovalSteps)
    private stepsRepository: Repository<ApprovalSteps>,
    @InjectRepository(Users) private usersRepository: Repository<Users>,
    @InjectRepository(Channels)
    private channelsRepository: Repository<Channels>,
    @InjectRepository(ChannelMembers)
    private channelMembersRepository: Repository<ChannelMembers>,
    private workspacesService: WorkspacesService,
    private channelsService: ChannelsService,
    private dmsService: DmsService,
    private botsService: BotsService,
    private eventsGateway: EventsGateway,
  ) {}

  async create(url: string, dto: CreateApprovalDto, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    const role = await this.workspacesService.assertMember(workspace.id, myId);
    const approverIds = [...new Set(dto.approverIds)];
    if (approverIds.includes(myId)) {
      throw new BadRequestException(
        '내가 요청한 결재는 내가 승인할 수 없습니다.',
      );
    }
    const visible =
      role === 'guest'
        ? await this.workspacesService.visibleMemberIds(workspace.id, myId)
        : null;
    for (const id of approverIds) {
      await this.workspacesService.assertMember(workspace.id, id);
      if ((await this.botsService.isBot(id)) || (visible && !visible.has(id))) {
        throw new BadRequestException('결재자로 정할 수 없는 사람이 있습니다.');
      }
    }
    if (!dto.channel === !dto.dmUserId) {
      throw new BadRequestException(
        '카드를 올릴 채널이나 DM 하나를 골라 주세요.',
      );
    }
    let channelId: number | null = null;
    if (dto.channel) {
      // 채널 멤버이고 보관되지 않은 채널인지 (아니면 여기서 거절된다)
      const channel = await this.channelsService.getWorkspaceChannel(
        url,
        dto.channel,
        myId,
      );
      if (channel.archived) {
        throw new ForbiddenException('보관된 채널에는 쓸 수 없습니다.');
      }
      channelId = channel.id;
    }
    const approval = await this.approvalsRepository.save({
      WorkspaceId: workspace.id,
      RequesterId: myId,
      kind: dto.kind,
      title: dto.title.trim(),
      body: dto.body?.trim() || null,
      fields: dto.fields ? JSON.stringify(dto.fields).slice(0, 1000) : null,
      status: 'pending' as const,
      ChannelId: channelId,
      PeerId: dto.dmUserId || null,
    });
    await this.stepsRepository.save(
      approverIds.map((ApproverId, position) => ({
        ApprovalId: approval.id,
        position,
        ApproverId,
        status: position === 0 ? ('pending' as const) : ('waiting' as const),
      })),
    );
    const content = toApprovalContent(approval.id, approval.title);
    if (dto.channel) {
      await this.channelsService.postChat(url, dto.channel, content, myId);
    } else {
      await this.dmsService.createWorkspaceDMChats(
        url,
        content,
        dto.dmUserId as number,
        myId,
      );
    }
    const requester = await this.usersRepository.findOne({
      where: { id: myId },
    });
    // DM 상대가 첫 결재자면 이미 카드를 봤으므로 봇 DM 은 보내지 않는다
    if (approverIds[0] !== dto.dmUserId) {
      await this.botNote(
        url,
        workspace.id,
        approverIds[0],
        approval,
        `${requester?.nickname} 님이 ${
          KIND_LABELS[approval.kind] || '결재'
        }를 요청했어요`,
      );
    }
    return this.get(url, approval.id, myId);
  }

  private async botNote(
    url: string,
    workspaceId: number,
    userId: number,
    approval: Approvals,
    note: string,
  ) {
    try {
      const botId = await this.botsService.ensureMember(workspaceId);
      await this.dmsService.createWorkspaceDMChats(
        url,
        toApprovalContent(approval.id, approval.title, note),
        userId,
        botId,
      );
    } catch (error) {
      this.logger.warn(
        `결재 알림을 보내지 못했습니다: ${(error as Error).message}`,
      );
    }
  }

  private async load(url: string, id: number, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertMember(workspace.id, myId);
    const approval = await this.approvalsRepository.findOne({
      where: { id, WorkspaceId: workspace.id },
      relations: ['Steps'],
    });
    if (!approval) {
      throw new NotFoundException('존재하지 않는 결재입니다.');
    }
    approval.Steps.sort((a, b) => a.position - b.position);
    // 요청한 사람, 결재자, 카드를 올린 채널 멤버, DM 의 두 사람만 본다
    const involved =
      approval.RequesterId === myId ||
      approval.PeerId === myId ||
      approval.Steps.some((s) => s.ApproverId === myId) ||
      (approval.ChannelId !== null &&
        !!(await this.channelMembersRepository.findOne({
          where: { ChannelId: approval.ChannelId, UserId: myId },
        })));
    if (!involved) {
      throw new NotFoundException('존재하지 않는 결재입니다.');
    }
    return { workspace, approval };
  }

  async get(url: string, id: number, myId: number) {
    const { approval } = await this.load(url, id, myId);
    const userIds = [
      approval.RequesterId,
      ...approval.Steps.map((s) => s.ApproverId),
    ];
    const users = await this.usersRepository.find({
      where: { id: In(userIds) },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const current = approval.Steps.find((s) => s.status === 'pending');
    let fields: Record<string, string> = {};
    try {
      fields = approval.fields ? JSON.parse(approval.fields) : {};
    } catch {
      fields = {};
    }
    return {
      id: approval.id,
      kind: approval.kind,
      title: approval.title,
      body: approval.body,
      fields,
      status: approval.status,
      createdAt: approval.createdAt,
      decidedAt: approval.decidedAt,
      requester: userView(byId.get(approval.RequesterId)),
      steps: approval.Steps.map((s) => ({
        position: s.position,
        status: s.status,
        comment: s.comment,
        decidedAt: s.decidedAt,
        approver: userView(byId.get(s.ApproverId)),
      })),
      myTurn: approval.status === 'pending' && current?.ApproverId === myId,
      canCancel: approval.status === 'pending' && approval.RequesterId === myId,
    };
  }

  async decide(
    url: string,
    id: number,
    decision: 'approve' | 'reject',
    comment: string | undefined,
    myId: number,
  ) {
    const { workspace, approval } = await this.load(url, id, myId);
    const step = approval.Steps.find((s) => s.status === 'pending');
    if (approval.status !== 'pending' || !step || step.ApproverId !== myId) {
      throw new ForbiddenException('지금은 내가 결재할 차례가 아닙니다.');
    }
    const now = new Date();
    const me = await this.usersRepository.findOne({ where: { id: myId } });
    await this.stepsRepository.update(step.id, {
      status: decision === 'approve' ? 'approved' : 'rejected',
      comment: comment?.trim() || null,
      decidedAt: now,
    });
    const next = approval.Steps.find(
      (s) => s.position > step.position && s.status === 'waiting',
    );
    if (decision === 'reject') {
      await this.finish(approval, 'rejected', now);
      await this.botNote(
        url,
        workspace.id,
        approval.RequesterId,
        approval,
        `${me?.nickname} 님이 반려했어요${
          comment?.trim() ? `: ${comment.trim()}` : ''
        }`,
      );
    } else if (next) {
      await this.stepsRepository.update(next.id, { status: 'pending' });
      await this.botNote(
        url,
        workspace.id,
        next.ApproverId,
        approval,
        `${me?.nickname} 님이 승인했고, 이제 내 차례예요`,
      );
    } else {
      await this.finish(approval, 'approved', now);
      await this.botNote(
        url,
        workspace.id,
        approval.RequesterId,
        approval,
        '모두 승인했어요',
      );
    }
    this.emitUpdated(url, approval);
    return this.get(url, id, myId);
  }

  async cancel(url: string, id: number, myId: number) {
    const { approval } = await this.load(url, id, myId);
    if (approval.RequesterId !== myId || approval.status !== 'pending') {
      throw new ForbiddenException('진행 중인 내 결재만 취소할 수 있습니다.');
    }
    await this.finish(approval, 'canceled', new Date());
    this.emitUpdated(url, approval);
    return this.get(url, id, myId);
  }

  private async finish(
    approval: Approvals,
    status: 'approved' | 'rejected' | 'canceled',
    now: Date,
  ) {
    await this.approvalsRepository.update(approval.id, {
      status,
      decidedAt: now,
    });
    // 남은 단계는 건너뛴다
    const rest = approval.Steps.filter(
      (s) =>
        s.status === 'waiting' ||
        (status === 'canceled' && s.status === 'pending'),
    );
    for (const s of rest) {
      await this.stepsRepository.update(s.id, { status: 'skipped' });
    }
  }

  // 카드를 보고 있는 사람들이 새로 불러오게 한다
  private emitUpdated(url: string, approval: Approvals) {
    const data = { id: approval.id };
    if (approval.ChannelId) {
      this.eventsGateway.server
        .to(`/ws-${url}-${approval.ChannelId}`)
        .emit('approvalUpdated', data);
    }
    new Set([
      approval.RequesterId,
      ...(approval.PeerId ? [approval.PeerId] : []),
      ...approval.Steps.map((s) => s.ApproverId),
    ]).forEach((id) =>
      this.eventsGateway.emitToUser(url, id, 'approvalUpdated', data),
    );
  }

  // 내가 결재할 차례인 것
  async pending(url: string, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertMember(workspace.id, myId);
    const rows = await this.approvalsRepository
      .createQueryBuilder('a')
      .innerJoin(
        'a.Steps',
        's',
        's.ApproverId = :myId AND s.status = :pending',
        { myId, pending: 'pending' },
      )
      .leftJoin(Users, 'u', 'u.id = a.RequesterId')
      .select([
        'a.id AS id',
        'a.title AS title',
        'a.kind AS kind',
        'a.createdAt AS createdAt',
        'u.nickname AS requesterName',
      ])
      .where('a.WorkspaceId = :workspaceId', { workspaceId: workspace.id })
      .andWhere('a.status = :status', { status: 'pending' })
      .orderBy('a.createdAt', 'ASC')
      .getRawMany();
    return rows.map((r) => ({ ...r, id: Number(r.id) }));
  }
}
