import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as Y from 'yjs';
import { BotsService } from '../bots/bots.service';
import { DmsService } from '../dms/dms.service';
import { visibleFor } from '../docs/docs.service';
import { DocTasks } from '../entities/DocTasks';
import { Docs } from '../entities/Docs';
import { Users } from '../entities/Users';
import { EventsGateway } from '../events/events.gateway';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { readTasks } from './task-index';

// 이 데이터베이스를 한 번이라도 읽었다는 표시 (처음 읽을 때 예전 담당자에게 알림이 몰려 가지 않게)
const MARKER = '__indexed__';
// 처음 읽을 때는 방금 만든 항목만 알린다
const FRESH_MS = 10 * 60 * 1000;

const toIds = (value: string) =>
  value
    .split(',')
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v > 0);
const toField = (ids: number[]) => (ids.length ? `,${ids.join(',')},` : '');

// "내 할 일": 데이터베이스 항목 중 나를 담당자로 넣은 것을 모아 보고, 새로 맡으면 알린다
@Injectable()
export class TasksService {
  private logger = new Logger('Tasks');

  constructor(
    @InjectRepository(DocTasks) private tasksRepository: Repository<DocTasks>,
    @InjectRepository(Docs) private docsRepository: Repository<Docs>,
    @InjectRepository(Users) private usersRepository: Repository<Users>,
    private workspacesService: WorkspacesService,
    private dmsService: DmsService,
    private botsService: BotsService,
    private eventsGateway: EventsGateway,
  ) {}

  // 데이터베이스를 저장할 때마다 할 일 목록을 다시 적는다
  async indexDatabase(
    url: string,
    docId: number,
    ydoc: Y.Doc,
    editorId: number | null,
  ) {
    const doc = await this.docsRepository.findOne({
      where: { id: docId },
      select: ['id', 'WorkspaceId', 'type', 'title', 'visibility', 'OwnerId'],
    });
    if (!doc || doc.type !== 'database') return;
    const rows = readTasks(ydoc);
    const existing = await this.tasksRepository.find({
      where: { DocId: docId },
    });
    const indexedBefore = existing.some((t) => t.RowId === MARKER);
    const before = new Map(
      existing.filter((t) => t.RowId !== MARKER).map((t) => [t.RowId, t]),
    );
    const now = new Date();
    const affected = new Set<number>();
    const assigned: { userId: number; row: (typeof rows)[number] }[] = [];

    for (const row of rows) {
      const prev = before.get(row.rowId);
      before.delete(row.rowId);
      const prevIds = new Set(prev ? toIds(prev.assignees) : []);
      const fresh = indexedBefore || row.createdAt > Date.now() - FRESH_MS;
      row.assignees
        .filter((id) => !prevIds.has(id) && id !== editorId)
        .forEach((userId) => {
          if (!row.done && fresh) assigned.push({ userId, row });
        });
      const fields = {
        title: row.title,
        due: row.due,
        statusName: row.statusName,
        done: row.done,
        assignees: toField(row.assignees),
      };
      const changed =
        !prev ||
        prev.title !== fields.title ||
        prev.due !== fields.due ||
        prev.statusName !== fields.statusName ||
        !!prev.done !== fields.done ||
        prev.assignees !== fields.assignees;
      if (!changed) continue;
      [...prevIds, ...row.assignees].forEach((id) => affected.add(id));
      if (prev) {
        await this.tasksRepository.update(prev.id, {
          ...fields,
          updatedAt: now,
        });
      } else {
        await this.tasksRepository.save({
          DocId: docId,
          RowId: row.rowId,
          WorkspaceId: doc.WorkspaceId,
          ...fields,
          updatedAt: now,
        });
      }
    }
    // 지워졌거나 담당자가 빠진 항목
    if (before.size) {
      before.forEach((t) =>
        toIds(t.assignees).forEach((id) => affected.add(id)),
      );
      await this.tasksRepository.delete({
        id: In([...before.values()].map((t) => t.id)),
      });
    }
    if (!indexedBefore) {
      await this.tasksRepository.save({
        DocId: docId,
        RowId: MARKER,
        WorkspaceId: doc.WorkspaceId,
        title: '',
        assignees: '',
        done: true,
        updatedAt: now,
      });
    }
    affected.forEach((id) =>
      this.eventsGateway.emitToUser(url, id, 'tasksChanged'),
    );
    if (assigned.length)
      await this.notifyAssigned(url, doc, editorId, assigned);
  }

  // 새로 맡은 사람에게 봇 DM (볼 수 있는 데이터베이스일 때만, 접속해 있지 않으면 푸시로도 간다)
  private async notifyAssigned(
    url: string,
    doc: Docs,
    editorId: number | null,
    assigned: {
      userId: number;
      row: { rowId: string; title: string; due: string | null };
    }[],
  ) {
    const editor = editorId
      ? await this.usersRepository.findOne({
          where: { id: editorId },
          select: ['id', 'nickname'],
        })
      : null;
    const botId = await this.botsService.ensureMember(doc.WorkspaceId);
    for (const { userId, row } of assigned) {
      if (userId === botId || !(await this.canView(doc, userId))) continue;
      const due = row.due
        ? ` · 마감 ${Number(row.due.slice(5, 7))}/${Number(
            row.due.slice(8, 10),
          )}`
        : '';
      const text = `📋 ${
        editor?.nickname || '누군가'
      } 님이 할 일을 맡겼어요: **${
        row.title
      }**${due}\n/workspace/${url}/docs/d/${doc.id}?row=${row.rowId}`;
      try {
        await this.dmsService.createWorkspaceDMChats(url, text, userId, botId);
      } catch (error) {
        this.logger.warn(
          `할 일 알림을 보내지 못했습니다: ${(error as Error).message}`,
        );
      }
    }
  }

  private async canView(doc: Docs, userId: number) {
    const role = await this.workspacesService.roleOf(doc.WorkspaceId, userId);
    if (!role) return false;
    const found = await this.docsRepository
      .createQueryBuilder('d')
      .where('d.id = :id', { id: doc.id })
      .andWhere(visibleFor(role), { me: userId })
      .getCount();
    return found > 0;
  }

  // 내 할 일 (안 끝난 것 먼저, 마감이 이른 순)
  async listMine(url: string, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    const role = await this.workspacesService.assertMember(workspace.id, myId);
    const rows = await this.tasksRepository
      .createQueryBuilder('t')
      .innerJoin(Docs, 'd', 'd.id = t.DocId AND d.deletedAt IS NULL')
      .select([
        't.DocId AS docId',
        't.RowId AS rowId',
        't.title AS title',
        't.due AS due',
        't.statusName AS statusName',
        't.done AS done',
        'd.title AS docTitle',
      ])
      .where('t.WorkspaceId = :workspaceId', { workspaceId: workspace.id })
      .andWhere('t.assignees LIKE :mine', { mine: `%,${myId},%` })
      .andWhere(visibleFor(role), { me: myId })
      .orderBy('t.done', 'ASC')
      .addOrderBy('t.due IS NULL', 'ASC')
      .addOrderBy('t.due', 'ASC')
      .addOrderBy('t.id', 'DESC')
      .limit(200)
      .getRawMany();
    return rows.map((r) => ({
      docId: Number(r.docId),
      rowId: r.rowId,
      title: r.title,
      due: r.due,
      statusName: r.statusName,
      done: !!Number(r.done),
      docTitle: r.docTitle,
    }));
  }
}
