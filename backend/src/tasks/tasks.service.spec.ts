import * as Y from 'yjs';
import { TasksService } from './tasks.service';
import { readTasks } from './task-index';

// 프론트 데이터베이스와 같은 구조로 Yjs 문서를 만든다
const makeDb = (rows: Record<string, Record<string, unknown>>) => {
  const doc = new Y.Doc();
  const props = doc.getArray<Y.Map<unknown>>('properties');
  [
    { id: 'name', name: '할 일', type: 'title' },
    {
      id: 'status',
      name: '상태',
      type: 'status',
      options: [
        { id: 'todo', name: '할 일' },
        { id: 'done', name: '완료' },
      ],
    },
    { id: 'owner', name: '담당자', type: 'person' },
    { id: 'due', name: '마감일', type: 'date' },
  ].forEach((p) => {
    const m = new Y.Map<unknown>();
    props.push([m]);
    Object.entries(p).forEach(([k, v]) => m.set(k, v));
  });
  const yRows = doc.getMap<Y.Map<unknown>>('rows');
  Object.entries(rows).forEach(([id, values]) => {
    const m = new Y.Map<unknown>();
    yRows.set(id, m);
    Object.entries(values).forEach(([k, v]) => m.set(k, v));
  });
  return doc;
};

describe('할 일 읽기', () => {
  it('담당자가 있는 항목만, 완료 상태를 알아본다', () => {
    const doc = makeDb({
      r1: {
        name: '시안 검토',
        owner: ['6'],
        due: '2026-10-30',
        status: 'todo',
      },
      r2: { name: '끝난 일', owner: ['6', '7'], status: 'done' },
      r3: { name: '담당 없음' },
    });
    const tasks = readTasks(doc);
    expect(tasks.map((t) => t.rowId).sort()).toEqual(['r1', 'r2']);
    expect(tasks.find((t) => t.rowId === 'r1')).toMatchObject({
      title: '시안 검토',
      assignees: [6],
      due: '2026-10-30',
      done: false,
    });
    expect(tasks.find((t) => t.rowId === 'r2')?.done).toBe(true);
  });
});

describe('할 일 맡김 알림', () => {
  let stored: {
    id: number;
    RowId: string;
    assignees: string;
    [k: string]: unknown;
  }[];
  const tasksRepository = {
    find: jest.fn(() => Promise.resolve(stored)),
    save: jest.fn((v) => {
      stored.push({ id: stored.length + 1, ...v });
      return Promise.resolve(v);
    }),
    update: jest.fn((id, v) => {
      const row = stored.find((s) => s.id === id);
      if (row) Object.assign(row, v);
      return Promise.resolve();
    }),
    delete: jest.fn(),
  };
  const qb = {
    where: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    getCount: jest.fn().mockResolvedValue(1),
  };
  const docsRepository = {
    findOne: jest.fn().mockResolvedValue({
      id: 9,
      WorkspaceId: 1,
      type: 'database',
      title: '할 일',
    }),
    createQueryBuilder: () => qb,
  };
  const usersRepository = {
    findOne: jest.fn().mockResolvedValue({ id: 5, nickname: '문서왕' }),
  };
  const workspacesService = { roleOf: jest.fn().mockResolvedValue('member') };
  const dmsService = { createWorkspaceDMChats: jest.fn() };
  const botsService = { ensureMember: jest.fn().mockResolvedValue(77) };
  const eventsGateway = { emitToUser: jest.fn() };
  const service = new TasksService(
    tasksRepository as never,
    docsRepository as never,
    usersRepository as never,
    workspacesService as never,
    dmsService as never,
    botsService as never,
    eventsGateway as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    stored = [];
  });

  it('처음 읽을 때는 방금 만든 항목만 알리고, 그 뒤로는 새로 맡은 사람에게 알린다', async () => {
    const old = Date.now() - 24 * 3600e3;
    await service.indexDatabase(
      'ws',
      9,
      makeDb({
        r1: { name: '예전 일', owner: ['6'], __createdAt: old },
        r2: { name: '새 일', owner: ['6'], __createdAt: Date.now() },
      }),
      5,
    );
    expect(dmsService.createWorkspaceDMChats).toHaveBeenCalledTimes(1);
    expect(dmsService.createWorkspaceDMChats.mock.calls[0][1]).toContain(
      '새 일',
    );
    expect(dmsService.createWorkspaceDMChats.mock.calls[0][1]).toContain(
      '/workspace/ws/docs/d/9?row=r2',
    );

    // 예전 일을 7 번에게도 맡긴다 → 7 번만 알림
    dmsService.createWorkspaceDMChats.mockClear();
    await service.indexDatabase(
      'ws',
      9,
      makeDb({
        r1: { name: '예전 일', owner: ['6', '7'], __createdAt: old },
        r2: { name: '새 일', owner: ['6'], __createdAt: Date.now() },
      }),
      5,
    );
    expect(dmsService.createWorkspaceDMChats).toHaveBeenCalledTimes(1);
    expect(dmsService.createWorkspaceDMChats.mock.calls[0][2]).toBe(7);
    expect(eventsGateway.emitToUser).toHaveBeenCalledWith(
      'ws',
      7,
      'tasksChanged',
    );
  });

  it('스스로 맡거나 이미 끝난 일은 알리지 않는다', async () => {
    await service.indexDatabase(
      'ws',
      9,
      makeDb({
        r1: { name: '내가 맡음', owner: ['5'], __createdAt: Date.now() },
        r2: {
          name: '끝난 일',
          owner: ['6'],
          status: 'done',
          __createdAt: Date.now(),
        },
      }),
      5,
    );
    expect(dmsService.createWorkspaceDMChats).not.toHaveBeenCalled();
  });
});
