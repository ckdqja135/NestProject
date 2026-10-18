import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelChats } from '../entities/ChannelChats';
import { DMs } from '../entities/DMs';
import { WorkspacesService } from '../workspaces/workspaces.service';

const SEARCH_LIMIT = 30;
const DAY = 24 * 60 * 60 * 1000;

export interface SearchFilters {
  q?: string;
  channel?: string;
  from?: number;
  after?: string;
  before?: string;
  page?: number;
  tz?: number;
}

// 'YYYY-MM-DD' 의 0시를 그 사용자 시간대(tz: getTimezoneOffset 분) 기준으로. tz 가 없으면 서버 시간대
export function startOfDay(date: string, tz?: number) {
  if (tz === undefined) {
    return new Date(`${date}T00:00:00`);
  }
  const [y, m, d] = date.split('-').map(Number);
  const local = new Date(Date.UTC(y, m - 1, d));
  // 2026-13-99 처럼 넘치는 날짜는 Date.UTC 가 다음 달로 넘겨 버리므로 직접 확인한다
  if (local.getUTCMonth() !== m - 1 || local.getUTCDate() !== d) {
    return new Date(NaN);
  }
  return new Date(local.getTime() + tz * 60 * 1000);
}

// LIKE 패턴에서 와일드카드로 해석되는 문자를 이스케이프
export function escapeLike(keyword: string) {
  return keyword.replace(/[\\%_]/g, (c) => `\\${c}`);
}

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(ChannelChats)
    private channelChatsRepository: Repository<ChannelChats>,
    @InjectRepository(DMs) private dmsRepository: Repository<DMs>,
    private workspacesService: WorkspacesService,
  ) {}

  // 검색어와 필터(채널, 보낸 사람, 기간)로 찾는다. 채널 메시지와 DM 을 따로 페이지로 나눠 돌려준다.
  async search(url: string, filters: SearchFilters, myId: number) {
    const q = (filters.q || '').trim();
    const hasFilter =
      !!filters.channel ||
      !!filters.from ||
      !!filters.after ||
      !!filters.before;
    if (!q && !hasFilter) {
      throw new BadRequestException('검색어를 입력해주세요.');
    }
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertMember(workspace.id, myId);
    const like = `%${escapeLike(q)}%`;
    const page = filters.page || 1;
    const skip = (page - 1) * SEARCH_LIMIT;
    // 한 개 더 가져와서 다음 페이지가 있는지 알아낸다
    const take = SEARCH_LIMIT + 1;
    const after = filters.after ? startOfDay(filters.after, filters.tz) : null;
    const before = filters.before
      ? new Date(startOfDay(filters.before, filters.tz).getTime() + DAY)
      : null;
    if (
      (after && Number.isNaN(after.getTime())) ||
      (before && Number.isNaN(before.getTime()))
    ) {
      throw new BadRequestException('날짜가 올바르지 않습니다.');
    }

    // 내가 참여한 채널의 메시지만 검색
    const chatQuery = this.channelChatsRepository
      .createQueryBuilder('chats')
      .leftJoinAndSelect('chats.User', 'user') // 수신 웹훅 메시지는 보낸 사람(User)이 없다
      .innerJoinAndSelect('chats.Channel', 'channel')
      .innerJoin(
        'channel.ChannelMembers',
        'members',
        'members.UserId = :myId',
        { myId },
      )
      .where('channel.WorkspaceId = :workspaceId', {
        workspaceId: workspace.id,
      });
    if (q) {
      chatQuery.andWhere('chats.content LIKE :like', { like });
    }
    if (filters.channel) {
      chatQuery.andWhere('channel.name = :channel', {
        channel: filters.channel,
      });
    }
    if (filters.from) {
      chatQuery.andWhere('chats.UserId = :from', { from: filters.from });
    }
    if (after) {
      chatQuery.andWhere('chats.createdAt >= :after', { after });
    }
    if (before) {
      chatQuery.andWhere('chats.createdAt < :before', { before });
    }
    const chats = await chatQuery
      .orderBy('chats.createdAt', 'DESC')
      .skip(skip)
      .take(take)
      .getMany();

    // 내가 보내거나 받은 DM만 검색 (채널을 지정하면 DM 은 제외)
    let dms = [];
    if (!filters.channel) {
      const dmQuery = this.dmsRepository
        .createQueryBuilder('dms')
        .innerJoinAndSelect('dms.Sender', 'sender')
        .innerJoinAndSelect('dms.Receiver', 'receiver')
        .where('dms.WorkspaceId = :workspaceId', { workspaceId: workspace.id })
        .andWhere('(dms.SenderId = :myId OR dms.ReceiverId = :myId)', {
          myId,
        });
      if (q) {
        dmQuery.andWhere('dms.content LIKE :like', { like });
      }
      if (filters.from) {
        dmQuery.andWhere('dms.SenderId = :from', { from: filters.from });
      }
      if (after) {
        dmQuery.andWhere('dms.createdAt >= :after', { after });
      }
      if (before) {
        dmQuery.andWhere('dms.createdAt < :before', { before });
      }
      dms = await dmQuery
        .orderBy('dms.createdAt', 'DESC')
        .skip(skip)
        .take(take)
        .getMany();
    }

    return {
      chats: chats.slice(0, SEARCH_LIMIT),
      dms: dms.slice(0, SEARCH_LIMIT),
      hasMoreChats: chats.length > SEARCH_LIMIT,
      hasMoreDms: dms.length > SEARCH_LIMIT,
    };
  }
}
