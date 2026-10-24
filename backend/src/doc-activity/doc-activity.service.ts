import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as Y from 'yjs';
import { ChannelsService } from '../channels/channels.service';
import { ChannelTabs } from '../entities/ChannelTabs';
import { Docs } from '../entities/Docs';
import { Users } from '../entities/Users';
import { readRows, RowSummary } from '../tasks/task-index';

// 같은 문서 수정을 같은 채널에 다시 알리기까지 (계속 고치는 동안 매번 알리지 않게)
export const EDIT_NOTICE_GAP_MS = 30 * 60_000;
// 한 번 저장에 너무 많은 항목이 바뀌면 줄여서 알린다
const MAX_ROW_LINES = 5;
const BOT_NAME = '슐랙봇';

// 채널 탭의 문서에 일어난 일(댓글·수정·데이터베이스 항목)을 그 채널에 알린다 (탭에서 알림을 켠 것만)
@Injectable()
export class DocActivityService {
  private logger = new Logger('DocActivity');
  private lastEditNotice = new Map<string, number>();
  // 데이터베이스마다 지난번 항목 (서버가 한 대라 메모리에 둔다. 다시 켜면 다음 저장부터 비교)
  private snapshots = new Map<number, Map<string, RowSummary>>();

  constructor(
    @InjectRepository(ChannelTabs)
    private tabsRepository: Repository<ChannelTabs>,
    @InjectRepository(Docs) private docsRepository: Repository<Docs>,
    @InjectRepository(Users) private usersRepository: Repository<Users>,
    private channelsService: ChannelsService,
  ) {}

  private async targets(docId: number) {
    return this.tabsRepository.find({
      where: { DocId: docId, notify: true },
      relations: ['Channel'],
    });
  }

  private async names(docId: number, actorId: number | null) {
    const [doc, actor] = await Promise.all([
      this.docsRepository.findOne({
        where: { id: docId },
        select: ['id', 'title', 'type'],
      }),
      actorId
        ? this.usersRepository.findOne({
            where: { id: actorId },
            select: ['id', 'nickname'],
          })
        : null,
    ]);
    return {
      title: doc?.title || '문서',
      type: doc?.type,
      actor: actor?.nickname || '누군가',
    };
  }

  private async post(tabs: ChannelTabs[], text: string) {
    for (const tab of tabs) {
      if (!tab.Channel || tab.Channel.archived) continue;
      await this.channelsService
        .postBotMessage(tab.ChannelId, text, BOT_NAME)
        .catch((error: Error) =>
          this.logger.warn(`채널에 알리지 못했습니다: ${error.message}`),
        );
    }
  }

  // 새 댓글 (스레드 첫 댓글이나 답글)
  async comment(docId: number, actorId: number, content: string) {
    try {
      const tabs = await this.targets(docId);
      if (!tabs.length) return;
      const { title, actor } = await this.names(docId, actorId);
      const short = content.length > 80 ? `${content.slice(0, 80)}…` : content;
      await this.post(
        tabs,
        `💬 ${actor} 님이 **${title}** 에 댓글을 달았어요: “${short}”`,
      );
    } catch (error) {
      this.logger.warn(`댓글 알림 실패: ${(error as Error).message}`);
    }
  }

  // 문서를 고쳤다 (같은 문서는 채널마다 30분에 한 번만). 데이터베이스는 항목 알림으로 대신한다
  async edited(docId: number, actorId: number | null) {
    try {
      const tabs = await this.targets(docId);
      if (!tabs.length) return;
      const now = Date.now();
      const due = tabs.filter((tab) => {
        const key = `${tab.ChannelId}:${docId}`;
        if (now - (this.lastEditNotice.get(key) || 0) < EDIT_NOTICE_GAP_MS) {
          return false;
        }
        this.lastEditNotice.set(key, now);
        return true;
      });
      if (!due.length) return;
      const { title, type, actor } = await this.names(docId, actorId);
      if (type === 'database') return;
      await this.post(due, `📝 ${actor} 님이 **${title}** 을(를) 고쳤어요.`);
    } catch (error) {
      this.logger.warn(`수정 알림 실패: ${(error as Error).message}`);
    }
  }

  // 데이터베이스를 저장했다: 지난번과 비교해 새 항목과 상태 변경을 알린다
  async databaseSaved(docId: number, ydoc: Y.Doc, actorId: number | null) {
    try {
      const tabs = await this.targets(docId);
      if (!tabs.length) {
        this.snapshots.delete(docId);
        return;
      }
      const rows = readRows(ydoc);
      const before = this.snapshots.get(docId);
      this.snapshots.set(docId, rows);
      if (!before) return;
      const lines: string[] = [];
      rows.forEach((row, rowId) => {
        const prev = before.get(rowId);
        if (!prev) {
          lines.push(
            `➕ 새 항목: ${row.title}${
              row.statusName ? ` (${row.statusName})` : ''
            }`,
          );
        } else if (prev.statusName !== row.statusName && row.statusName) {
          lines.push(
            `🔄 ${row.title}: ${prev.statusName || '없음'} → ${row.statusName}`,
          );
        }
      });
      if (!lines.length) return;
      const { title, actor } = await this.names(docId, actorId);
      const shown = lines.slice(0, MAX_ROW_LINES);
      if (lines.length > MAX_ROW_LINES) {
        shown.push(`… 그 밖에 ${lines.length - MAX_ROW_LINES}개`);
      }
      await this.post(
        tabs,
        [`🗂 ${actor} 님이 **${title}** 을(를) 바꿨어요`, ...shown].join('\n'),
      );
    } catch (error) {
      this.logger.warn(`데이터베이스 알림 실패: ${(error as Error).message}`);
    }
  }
}
