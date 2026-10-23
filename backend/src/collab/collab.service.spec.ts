import { Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { CollabService } from './collab.service';

// 소켓 흉내: 보낸 것과 방에 뿌린 것을 기록한다
const fakeSocket = (id: string) => {
  const sent: { event: string; data: any }[] = [];
  const toRoom: { room: string; data: any }[] = [];
  const socket: any = {
    id,
    data: {},
    rooms: new Set<string>(),
    nsp: {
      name: '/ws-shlack',
      to: (room: string) => ({
        emit: (_: string, data: any) => toRoom.push({ room, data }),
      }),
    },
    join: (room: string) => socket.rooms.add(room),
    leave: (room: string) => socket.rooms.delete(room),
    emit: (event: string, data: any) => sent.push({ event, data }),
    to: (room: string) => ({
      emit: (_: string, data: any) => toRoom.push({ room, data }),
    }),
  };
  return { socket, sent, toRoom };
};

describe('CollabService', () => {
  const stored = new Map<number, Buffer>();
  const docsService = {
    collabAccess: jest.fn(),
    loadYdoc: jest.fn(async (id: number) => stored.get(id) || null),
    saveYdoc: jest.fn(async (_url: string, id: number, state: Uint8Array) => {
      stored.set(id, Buffer.from(state));
    }),
  };
  const gateway = { setCollabHandler: jest.fn() };
  let service: CollabService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    stored.clear();
    service = new CollabService(docsService as any, gateway as any);
  });
  afterEach(() => jest.useRealTimers());

  const edit = (text: string) => {
    const doc = new Y.Doc();
    doc.getText('t').insert(0, text);
    return Y.encodeStateAsUpdate(doc);
  };

  it('들어오면 현재 상태를 받고, 고친 내용은 다른 사람에게만 전달된다', async () => {
    docsService.collabAccess.mockResolvedValue({ canEdit: true });
    const a = fakeSocket('a');
    const b = fakeSocket('b');
    await service.handle(a.socket, { id: 1 }, { type: 'join', docId: 7 });
    await service.handle(b.socket, { id: 2 }, { type: 'join', docId: 7 });
    expect(a.sent[0].data).toMatchObject({
      type: 'sync',
      docId: 7,
      canEdit: true,
    });
    await service.handle(
      a.socket,
      { id: 1 },
      { type: 'update', docId: 7, update: edit('안녕') },
    );
    expect(a.toRoom).toEqual([
      { room: 'collab-7', data: expect.objectContaining({ type: 'update' }) },
    ]);
    // 나중에 들어온 사람은 바뀐 상태를 받는다
    const c = fakeSocket('c');
    await service.handle(c.socket, { id: 3 }, { type: 'join', docId: 7 });
    const doc = new Y.Doc();
    Y.applyUpdate(doc, c.sent[0].data.state);
    expect(doc.getText('t').toString()).toBe('안녕');
  });

  it('보기 권한만 있으면 고칠 수 없고, 볼 수 없는 문서는 들어갈 수 없다', async () => {
    docsService.collabAccess.mockResolvedValueOnce({ canEdit: false });
    const v = fakeSocket('v');
    await service.handle(v.socket, { id: 4 }, { type: 'join', docId: 8 });
    await service.handle(
      v.socket,
      { id: 4 },
      { type: 'update', docId: 8, update: edit('몰래') },
    );
    expect(v.toRoom).toEqual([]);
    docsService.collabAccess.mockRejectedValueOnce(new Error('없음'));
    const x = fakeSocket('x');
    await service.handle(x.socket, { id: 5 }, { type: 'join', docId: 9 });
    expect(x.sent[0].data).toEqual({
      type: 'error',
      docId: 9,
      reason: 'not-found',
    });
    expect(x.socket.rooms.size).toBe(0);
  });

  it('잠시 조용해지면 저장하고, 다시 열면 저장한 내용에서 시작한다', async () => {
    docsService.collabAccess.mockResolvedValue({ canEdit: true });
    const a = fakeSocket('a');
    await service.handle(a.socket, { id: 1 }, { type: 'join', docId: 7 });
    await service.handle(
      a.socket,
      { id: 1 },
      { type: 'update', docId: 7, update: edit('저장') },
    );
    await service.handle(
      a.socket,
      { id: 1 },
      { type: 'snapshot', docId: 7, content: '저장' },
    );
    expect(docsService.saveYdoc).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(2500);
    expect(docsService.saveYdoc).toHaveBeenCalledWith(
      'shlack',
      7,
      expect.any(Uint8Array),
      1,
      '저장',
    );
    // 모두 나가고 메모리에서 내린 뒤 다시 열기
    service.disconnect(a.socket);
    await jest.advanceTimersByTimeAsync(61_000);
    const b = fakeSocket('b');
    await service.handle(b.socket, { id: 2 }, { type: 'join', docId: 7 });
    const doc = new Y.Doc();
    Y.applyUpdate(doc, b.sent[0].data.state);
    expect(doc.getText('t').toString()).toBe('저장');
  });

  it('연결이 끊기면 그 사람의 커서를 지우고 남은 사람에게 알린다', async () => {
    docsService.collabAccess.mockResolvedValue({ canEdit: true });
    const a = fakeSocket('a');
    const b = fakeSocket('b');
    await service.handle(a.socket, { id: 1 }, { type: 'join', docId: 7 });
    await service.handle(b.socket, { id: 2 }, { type: 'join', docId: 7 });
    const local = new Awareness(new Y.Doc());
    local.setLocalStateField('user', { name: '가' });
    await service.handle(
      a.socket,
      { id: 1 },
      {
        type: 'awareness',
        docId: 7,
        update: encodeAwarenessUpdate(local, [local.clientID]),
      },
    );
    b.toRoom.length = 0;
    service.disconnect(a.socket);
    // 나간 사람의 커서를 지우는 알림이 방(collab-7)으로 간다 (a 의 nsp 로 보낸 기록)
    expect(a.toRoom).toContainEqual({
      room: 'collab-7',
      data: expect.objectContaining({ type: 'awareness', docId: 7 }),
    });
    local.destroy();
  });
});
