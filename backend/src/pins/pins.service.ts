import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ChannelChats } from '../entities/ChannelChats';
import { ChannelMembers } from '../entities/ChannelMembers';
import { SidebarPinKind, SidebarPins } from '../entities/SidebarPins';
import { WorkspaceMembers } from '../entities/WorkspaceMembers';
import { EventsGateway } from '../events/events.gateway';
import { WorkspacesService } from '../workspaces/workspaces.service';

// 너무 많이 고정하면 사이드바가 의미 없어진다
export const MAX_PINS = 30;
const PREVIEW_LENGTH = 80;

export const PIN_KINDS: SidebarPinKind[] = ['channel', 'dm', 'thread'];

@Injectable()
export class PinsService {
  constructor(
    @InjectRepository(SidebarPins)
    private pinsRepository: Repository<SidebarPins>,
    @InjectRepository(ChannelChats)
    private channelChatsRepository: Repository<ChannelChats>,
    @InjectRepository(ChannelMembers)
    private channelMembersRepository: Repository<ChannelMembers>,
    @InjectRepository(WorkspaceMembers)
    private workspaceMembersRepository: Repository<WorkspaceMembers>,
    private workspacesService: WorkspacesService,
    private eventsGateway: EventsGateway,
  ) {}

  private async findWorkspace(url: string, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertMember(workspace.id, myId);
    return workspace;
  }

  private assertKind(kind: string): asserts kind is SidebarPinKind {
    if (!PIN_KINDS.includes(kind as SidebarPinKind)) {
      throw new BadRequestException('고정할 수 없는 종류입니다.');
    }
  }

  private whereOf(
    kind: SidebarPinKind,
    targetId: number,
    myId: number,
    workspaceId: number,
  ) {
    if (kind === 'channel') {
      return { UserId: myId, WorkspaceId: workspaceId, ChannelId: targetId };
    }
    if (kind === 'dm') {
      return { UserId: myId, WorkspaceId: workspaceId, PeerId: targetId };
    }
    return { UserId: myId, WorkspaceId: workspaceId, ChatId: targetId };
  }

  private async isChannelMember(channelId: number, myId: number) {
    return !!(await this.channelMembersRepository.findOne({
      where: { ChannelId: channelId, UserId: myId },
    }));
  }

  // 고정할 수 있는(내가 볼 수 있는) 대상인지 확인
  private async assertVisible(
    workspaceId: number,
    kind: SidebarPinKind,
    targetId: number,
    myId: number,
  ) {
    if (kind === 'dm') {
      const member = await this.workspaceMembersRepository.findOne({
        where: { WorkspaceId: workspaceId, UserId: targetId },
      });
      if (!member) {
        throw new NotFoundException('워크스페이스에 없는 사용자입니다.');
      }
      return;
    }
    if (kind === 'channel') {
      const channel = await this.channelMembersRepository.findOne({
        where: { ChannelId: targetId, UserId: myId },
        relations: ['Channel'],
      });
      if (!channel || channel.Channel?.WorkspaceId !== workspaceId) {
        throw new NotFoundException('참여하지 않은 채널입니다.');
      }
      return;
    }
    const chat = await this.channelChatsRepository.findOne({
      where: { id: targetId },
      relations: ['Channel'],
    });
    if (
      !chat ||
      chat.Channel?.WorkspaceId !== workspaceId ||
      !(await this.isChannelMember(chat.ChannelId, myId))
    ) {
      throw new NotFoundException('존재하지 않는 스레드입니다.');
    }
    if (chat.ParentId) {
      throw new BadRequestException('스레드의 첫 메시지만 고정할 수 있습니다.');
    }
  }

  // 고정한 대화 (위에서부터). 나간 채널·지워진 대상은 빠진다
  async list(url: string, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    const pins = await this.pinsRepository
      .createQueryBuilder('pin')
      .leftJoinAndSelect('pin.Channel', 'channel')
      .leftJoin('pin.Peer', 'peer')
      .addSelect([
        'peer.id',
        'peer.nickname',
        'peer.email',
        'peer.avatarStyle',
        'peer.bot',
      ])
      .leftJoinAndSelect('pin.Chat', 'chat')
      .leftJoinAndSelect('chat.Channel', 'chatChannel')
      .leftJoin('chat.User', 'chatUser')
      .addSelect(['chatUser.id', 'chatUser.nickname'])
      .where('pin.UserId = :myId', { myId })
      .andWhere('pin.WorkspaceId = :workspaceId', { workspaceId: workspace.id })
      .orderBy('pin.position', 'ASC')
      .addOrderBy('pin.id', 'ASC')
      .getMany();

    const channelIds = Array.from(
      new Set(
        pins
          .map((p) => p.ChannelId ?? p.Chat?.ChannelId)
          .filter((id): id is number => typeof id === 'number'),
      ),
    );
    const memberships = channelIds.length
      ? await this.channelMembersRepository.find({
          where: { UserId: myId, ChannelId: In(channelIds) },
        })
      : [];
    const joined = new Set(memberships.map((m) => m.ChannelId));
    const replyCounts = new Map<number, number>();
    const threadIds = pins.filter((p) => p.Chat).map((p) => p.Chat!.id);
    if (threadIds.length) {
      const rows = await this.channelChatsRepository
        .createQueryBuilder('reply')
        .select('reply.ParentId', 'parentId')
        .addSelect('COUNT(*)', 'count')
        .where('reply.ParentId IN (:...threadIds)', { threadIds })
        .groupBy('reply.ParentId')
        .getRawMany<{ parentId: number; count: string }>();
      rows.forEach((r) => replyCounts.set(Number(r.parentId), Number(r.count)));
    }

    return pins
      .filter((p) => {
        if (p.kind === 'channel')
          return !!p.Channel && joined.has(p.Channel.id);
        if (p.kind === 'dm') return !!p.Peer;
        return !!p.Chat && joined.has(p.Chat.ChannelId);
      })
      .map((p) => ({
        id: p.id,
        kind: p.kind,
        position: p.position,
        channel:
          p.kind === 'channel' && p.Channel
            ? {
                id: p.Channel.id,
                name: p.Channel.name,
                private: !!p.Channel.private,
                archived: !!p.Channel.archived,
              }
            : null,
        user: p.kind === 'dm' ? p.Peer : null,
        thread:
          p.kind === 'thread' && p.Chat
            ? {
                id: p.Chat.id,
                channel: p.Chat.Channel?.name,
                author:
                  (p.Chat as ChannelChats & { User?: { nickname: string } })
                    .User?.nickname ||
                  p.Chat.botName ||
                  null,
                preview: p.Chat.content.slice(0, PREVIEW_LENGTH),
                replyCount: replyCounts.get(p.Chat.id) || 0,
              }
            : null,
      }));
  }

  async pin(url: string, kind: string, targetId: number, myId: number) {
    this.assertKind(kind);
    const workspace = await this.findWorkspace(url, myId);
    await this.assertVisible(workspace.id, kind, targetId, myId);
    const where = this.whereOf(kind, targetId, myId, workspace.id);
    if (await this.pinsRepository.findOne({ where })) {
      return;
    }
    const count = await this.pinsRepository.count({
      where: { UserId: myId, WorkspaceId: workspace.id },
    });
    if (count >= MAX_PINS) {
      throw new BadRequestException(`고정은 ${MAX_PINS}개까지 할 수 있습니다.`);
    }
    const last = await this.pinsRepository.findOne({
      where: { UserId: myId, WorkspaceId: workspace.id },
      order: { position: 'DESC' },
    });
    await this.pinsRepository.save({
      ...where,
      kind,
      position: (last?.position ?? -1) + 1,
    });
    this.eventsGateway.emitToUser(url, myId, 'sidebarPinsChanged');
  }

  async unpin(url: string, kind: string, targetId: number, myId: number) {
    this.assertKind(kind);
    const workspace = await this.findWorkspace(url, myId);
    await this.pinsRepository.delete(
      this.whereOf(kind, targetId, myId, workspace.id),
    );
    this.eventsGateway.emitToUser(url, myId, 'sidebarPinsChanged');
  }

  // 고정한 순서 바꾸기: 고정 id 를 위에서부터 차례로
  async reorder(url: string, ids: number[], myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    if (!Array.isArray(ids) || ids.some((id) => !Number.isInteger(id))) {
      throw new BadRequestException('순서가 올바르지 않습니다.');
    }
    const pins = await this.pinsRepository.find({
      where: { UserId: myId, WorkspaceId: workspace.id },
    });
    const mine = new Set(pins.map((p) => p.id));
    const order = ids.filter((id) => mine.has(id));
    // 목록에 없는 고정은 뒤에 원래 순서대로
    pins
      .sort((a, b) => a.position - b.position || a.id - b.id)
      .forEach((p) => !order.includes(p.id) && order.push(p.id));
    await Promise.all(
      order.map((id, position) =>
        this.pinsRepository.update({ id }, { position }),
      ),
    );
    this.eventsGateway.emitToUser(url, myId, 'sidebarPinsChanged');
  }
}
