import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ChannelChats } from '../entities/ChannelChats';
import { ChannelMembers } from '../entities/ChannelMembers';
import { Mentions } from '../entities/Mentions';
import { EventsGateway } from '../events/events.gateway';
import { onlineMap } from '../events/onlineMap';
import { WorkspacesService } from '../workspaces/workspaces.service';

const MENTION_PATTERN = /@\[(.+?)]\((\d+)\)/g;
const LIST_LIMIT = 50;

// 채팅 본문의 멘션 마크업(@[닉네임](id))에서 사용자 id 추출
export function parseMentionIds(content: string): number[] {
  const ids = new Set<number>();
  for (const match of content.matchAll(MENTION_PATTERN)) {
    ids.add(Number(match[2]));
  }
  return [...ids];
}

// 채널 전체 멘션: @[channel](channel) 은 채널 멤버 모두, @[here](here) 는 지금 접속 중인 채널 멤버
const SPECIAL_PATTERN = /@\[(channel|here)]\((channel|here)\)/g;

export function parseSpecialMentions(content: string) {
  const kinds = new Set<'channel' | 'here'>();
  for (const match of content.matchAll(SPECIAL_PATTERN)) {
    if (match[1] === match[2]) {
      kinds.add(match[1] as 'channel' | 'here');
    }
  }
  return { channel: kinds.has('channel'), here: kinds.has('here') };
}

@Injectable()
export class MentionsService {
  constructor(
    @InjectRepository(Mentions)
    private mentionsRepository: Repository<Mentions>,
    @InjectRepository(ChannelMembers)
    private channelMembersRepository: Repository<ChannelMembers>,
    private workspacesService: WorkspacesService,
    private eventsGateway: EventsGateway,
  ) {}

  // 새 채널 메시지에서 멘션된 채널 멤버에게 멘션을 기록하고 실시간으로 알린다
  async handleNewChat(url: string, workspaceId: number, chat: ChannelChats) {
    const mentionedIds = parseMentionIds(chat.content).filter(
      (id) => id !== chat.UserId,
    );
    const special = parseSpecialMentions(chat.content);
    if (!mentionedIds.length && !special.channel && !special.here) {
      return;
    }
    // 채널 멤버가 아닌 사람(비공개 채널 등)에게는 알리지 않는다
    const channelMembers = await this.channelMembersRepository.find({
      where:
        special.channel || special.here
          ? { ChannelId: chat.ChannelId }
          : { ChannelId: chat.ChannelId, UserId: In(mentionedIds) },
      select: ['UserId'],
    });
    const online = new Set(Object.values(onlineMap[`/ws-${url}`] || {}));
    const members = channelMembers.filter(
      ({ UserId }) =>
        UserId !== chat.UserId &&
        (mentionedIds.includes(UserId) ||
          special.channel ||
          (special.here && online.has(UserId))),
    );
    for (const { UserId } of members) {
      const mention = await this.mentionsRepository.save({
        category: 'chat' as const,
        ChatId: chat.id,
        WorkspaceId: workspaceId,
        SenderId: chat.UserId,
        ReceiverId: UserId,
      });
      this.eventsGateway.emitToUser(url, UserId, 'mention', {
        id: mention.id,
        chat,
      });
    }
  }

  // 메시지(와 그 답글)가 삭제되면 관련 멘션도 지우고 받은 사람에게 알린다
  async removeForChats(url: string, chatIds: number[]) {
    if (!chatIds.length) {
      return;
    }
    const mentions = await this.mentionsRepository.find({
      where: { category: 'chat', ChatId: In(chatIds) },
      select: ['id', 'ReceiverId'],
    });
    if (!mentions.length) {
      return;
    }
    await this.mentionsRepository.delete({ id: In(mentions.map((m) => m.id)) });
    new Set(mentions.map((m) => m.ReceiverId)).forEach((userId) =>
      this.eventsGateway.emitToUser(url, userId, 'mentionsChanged'),
    );
  }

  // 내가 받은 멘션 목록 (최신순) + 채널별 안 읽은 멘션 수
  async getMyMentions(url: string, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertMember(workspace.id, myId);
    const base = () =>
      this.mentionsRepository
        .createQueryBuilder('mention')
        .innerJoinAndMapOne(
          'mention.Chat',
          ChannelChats,
          'chat',
          'chat.id = mention.ChatId',
        )
        .innerJoinAndSelect('chat.Channel', 'channel')
        // 지금도 참여 중인 채널의 멘션만 (나간 채널, 비공개 채널 보호)
        .innerJoin(
          'channel.ChannelMembers',
          'members',
          'members.UserId = :myId',
          { myId },
        )
        .where('mention.WorkspaceId = :workspaceId', {
          workspaceId: workspace.id,
        })
        .andWhere('mention.ReceiverId = :myId', { myId })
        .andWhere('mention.category = :category', { category: 'chat' });

    const items = await base()
      .leftJoinAndSelect('chat.User', 'sender')
      .orderBy('mention.id', 'DESC')
      .take(LIST_LIMIT)
      .getMany();
    const unread = await base()
      .andWhere('mention.readAt IS NULL')
      .select('chat.ChannelId', 'channelId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('chat.ChannelId')
      .getRawMany<{ channelId: number; count: string }>();

    const unreadByChannel: Record<number, number> = {};
    unread.forEach((row) => {
      unreadByChannel[row.channelId] = Number(row.count);
    });
    const unreadTotal = Object.values(unreadByChannel).reduce(
      (sum, n) => sum + n,
      0,
    );
    return { items, unreadByChannel, unreadTotal };
  }

  // 멘션 읽음 처리 (channelId 가 있으면 그 채널의 멘션만)
  async markRead(url: string, myId: number, channelId?: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertMember(workspace.id, myId);
    const query = this.mentionsRepository
      .createQueryBuilder()
      .update(Mentions)
      .set({ readAt: () => 'CURRENT_TIMESTAMP' })
      .where('WorkspaceId = :workspaceId', { workspaceId: workspace.id })
      .andWhere('ReceiverId = :myId', { myId })
      .andWhere('readAt IS NULL');
    if (channelId) {
      query.andWhere(
        'ChatId IN (SELECT id FROM channelchats WHERE ChannelId = :channelId)',
        { channelId },
      );
    }
    const result = await query.execute();
    if (result.affected) {
      this.eventsGateway.emitToUser(url, myId, 'mentionsChanged');
    }
    return { updated: result.affected || 0 };
  }
}
