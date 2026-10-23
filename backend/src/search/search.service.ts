import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelChats } from '../entities/ChannelChats';
import { DMs } from '../entities/DMs';
import { Docs } from '../entities/Docs';
import { visibleFor } from '../docs/docs.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

const SEARCH_LIMIT = 30;
const DOC_LIMIT = 20;
const MENTION_LIMIT = 30;
// 본문까지 찾는 문서 종류 (슬라이드·시트 본문은 JSON 이라 제목만 찾는다)
const TEXT_DOC_TYPES = ['doc', 'wiki', 'database', 'board', 'design'];

export interface DocHit {
  id: number;
  title: string;
  type: string;
  snippet: string | null;
  updatedAt: Date;
  ownerName: string | null;
}
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
    @InjectRepository(Docs) private docsRepository: Repository<Docs>,
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
    const role = await this.workspacesService.assertMember(workspace.id, myId);
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

    // 문서: 내가 볼 수 있는 것 중 제목·본문에 검색어가 있는 것 (첫 페이지에만, 채널·보낸 사람 필터가 없을 때)
    let docs: DocHit[] = [];
    if (q && page === 1 && !filters.channel && !filters.from) {
      const docQuery = this.docsRepository
        .createQueryBuilder('d')
        .leftJoin('d.Owner', 'o')
        .select([
          'd.id AS id',
          'd.title AS title',
          'd.type AS type',
          'd.updatedAt AS updatedAt',
          'o.nickname AS ownerName',
        ])
        .addSelect(
          `CASE WHEN d.type IN (:...textTypes) AND d.content LIKE :like
             THEN SUBSTRING(d.content, GREATEST(1, LOCATE(:q, d.content) - 40), 160)
             ELSE NULL END`,
          'snippet',
        )
        .where('d.WorkspaceId = :workspaceId', { workspaceId: workspace.id })
        .andWhere(visibleFor(role), { me: myId })
        .andWhere(
          '(d.title LIKE :like OR (d.type IN (:...textTypes) AND d.content LIKE :like))',
          { like, q, textTypes: TEXT_DOC_TYPES },
        );
      if (after) {
        docQuery.andWhere('d.updatedAt >= :after', { after });
      }
      if (before) {
        docQuery.andWhere('d.updatedAt < :before', { before });
      }
      docs = await docQuery
        .orderBy('(d.title LIKE :like)', 'DESC')
        .addOrderBy('d.updatedAt', 'DESC')
        .limit(DOC_LIMIT)
        .getRawMany();
    }

    return {
      chats: chats.slice(0, SEARCH_LIMIT),
      dms: dms.slice(0, SEARCH_LIMIT),
      docs,
      hasMoreChats: chats.length > SEARCH_LIMIT,
      hasMoreDms: dms.length > SEARCH_LIMIT,
    };
  }

  // 이 문서가 언급된 대화: 내가 볼 수 있는 채널 메시지와 내 DM 중 문서 링크가 들어 있는 것
  async docMentions(url: string, docId: number, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    const role = await this.workspacesService.assertMember(workspace.id, myId);
    const doc = await this.docsRepository
      .createQueryBuilder('d')
      .where('d.id = :docId AND d.WorkspaceId = :workspaceId', {
        docId,
        workspaceId: workspace.id,
      })
      .andWhere(visibleFor(role), { me: myId })
      .getOne();
    if (!doc) {
      throw new NotFoundException('존재하지 않는 문서입니다.');
    }
    const like = `%/docs/d/${docId}%`;
    // d/12 를 찾을 때 d/123 은 빼려고 한 번 더 거른다
    const exact = new RegExp(`/docs/d/${docId}(?!\\d)`);
    const chats = await this.channelChatsRepository
      .createQueryBuilder('chats')
      .leftJoinAndSelect('chats.User', 'user')
      .innerJoinAndSelect('chats.Channel', 'channel')
      .innerJoin(
        'channel.ChannelMembers',
        'members',
        'members.UserId = :myId',
        {
          myId,
        },
      )
      .where('channel.WorkspaceId = :workspaceId', {
        workspaceId: workspace.id,
      })
      .andWhere('chats.content LIKE :like', { like })
      .orderBy('chats.createdAt', 'DESC')
      .take(MENTION_LIMIT)
      .getMany();
    const dms = await this.dmsRepository
      .createQueryBuilder('dms')
      .innerJoinAndSelect('dms.Sender', 'sender')
      .innerJoinAndSelect('dms.Receiver', 'receiver')
      .where('dms.WorkspaceId = :workspaceId', { workspaceId: workspace.id })
      .andWhere('(dms.SenderId = :myId OR dms.ReceiverId = :myId)', { myId })
      .andWhere('dms.content LIKE :like', { like })
      .orderBy('dms.createdAt', 'DESC')
      .take(MENTION_LIMIT)
      .getMany();
    return {
      chats: chats.filter((c) => exact.test(c.content)),
      dms: dms.filter((d) => exact.test(d.content)),
    };
  }
}
