import {
  Optional,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Socket } from 'socket.io';
import {
  applyAwarenessUpdate,
  Awareness,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness';
import * as Y from 'yjs';
import { DocsService } from '../docs/docs.service';
import { TasksService } from '../tasks/tasks.service';
import { EventsGateway } from '../events/events.gateway';

// 실시간 동시 편집 (Yjs). 문서마다 서버 메모리에 공동 편집 상태를 하나 두고,
// 들어온 사람들의 변경을 서로에게 전달하며, 잠시 조용해지면 DB 에 저장한다.

const SAVE_DELAY_MS = 2000;
const MAX_SAVE_WAIT_MS = 10_000;
const UNLOAD_DELAY_MS = 60_000;
const MAX_UPDATE = 4 * 1024 * 1024;
const MAX_SNAPSHOT = 2 * 1024 * 1024;

interface Room {
  url: string;
  docId: number;
  type: string;
  ydoc: Y.Doc;
  awareness: Awareness;
  // 소켓 id → 그 소켓의 커서(awareness) clientID 들
  sockets: Map<string, Set<number>>;
  // 고칠 수 있는 소켓들
  editors: Set<string>;
  // 예전(마크다운) 문서를 처음 열 때: 한 사람만 마크다운을 블록으로 옮겨 넣는다 (여럿이 넣으면 내용이 겹친다)
  needsSeed: boolean;
  seeder: string | null;
  dirty: boolean;
  firstDirtyAt: number;
  lastEditorId: number | null;
  snapshot: string | undefined;
  saveTimer: NodeJS.Timeout | null;
  unloadTimer: NodeJS.Timeout | null;
}

export type CollabMessage =
  | { type: 'join'; docId: number }
  | { type: 'leave'; docId: number }
  | { type: 'update'; docId: number; update: Buffer | Uint8Array }
  | { type: 'awareness'; docId: number; update: Buffer | Uint8Array }
  | { type: 'snapshot'; docId: number; content: string };

const roomName = (docId: number) => `collab-${docId}`;
// 처음 열 때 한 사람만 처음 내용을 넣어야 하는 문서 종류 (예전 마크다운, 데이터베이스 기본 칸·템플릿)
const SEEDED_TYPES = ['doc', 'wiki', 'database', 'design'];
const toBytes = (data: unknown) =>
  data instanceof Uint8Array
    ? data
    : data instanceof ArrayBuffer
      ? new Uint8Array(data)
      : null;

@Injectable()
export class CollabService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('Collab');
  private rooms = new Map<number, Room>();
  private loading = new Map<number, Promise<Room>>();

  constructor(
    private docsService: DocsService,
    private eventsGateway: EventsGateway,
    // 데이터베이스를 저장하면 "내 할 일" 목록도 다시 적는다 (테스트처럼 없으면 건너뛴다)
    @Optional() private tasksService?: TasksService,
  ) {}

  onModuleInit() {
    this.eventsGateway.setCollabHandler(this);
    // 문서 허들: 그 문서를 볼 수 있는 사람이면 들어간다
    this.eventsGateway.setScopeResolver('doc', async (url, id, userId) => {
      const { doc } = await this.docsService.collabAccess(url, id, userId);
      return { ok: true, label: doc.title };
    });
  }

  async onModuleDestroy() {
    await Promise.all([...this.rooms.values()].map((room) => this.save(room)));
  }

  // 소켓이 들어가 있는 문서들과 편집 권한
  private joined(socket: Socket): Map<number, { canEdit: boolean }> {
    if (!socket.data.collab) {
      socket.data.collab = new Map();
    }
    return socket.data.collab;
  }

  private async room(url: string, docId: number, type: string) {
    const existing = this.rooms.get(docId);
    if (existing) {
      return existing;
    }
    let task = this.loading.get(docId);
    if (!task) {
      task = (async () => {
        const ydoc = new Y.Doc();
        const stored = await this.docsService.loadYdoc(docId);
        if (stored?.length) {
          Y.applyUpdate(ydoc, new Uint8Array(stored));
        }
        const needsSeed = !stored?.length && SEEDED_TYPES.includes(type);
        const awareness = new Awareness(ydoc);
        awareness.setLocalState(null); // 서버 자신은 커서가 없다
        const room: Room = {
          url,
          docId,
          type,
          ydoc,
          awareness,
          sockets: new Map(),
          editors: new Set(),
          needsSeed,
          seeder: null,
          dirty: false,
          firstDirtyAt: 0,
          lastEditorId: null,
          snapshot: undefined,
          saveTimer: null,
          unloadTimer: null,
        };
        // 어떤 커서가 어느 소켓 것인지 기억한다 (연결이 끊기면 지우려고)
        awareness.on(
          'update',
          (
            { added, updated }: { added: number[]; updated: number[] },
            origin: unknown,
          ) => {
            const ids = room.sockets.get(origin as string);
            if (ids) {
              [...added, ...updated].forEach((id) => ids.add(id));
            }
          },
        );
        this.rooms.set(docId, room);
        return room;
      })().finally(() => this.loading.delete(docId));
      this.loading.set(docId, task);
    }
    return task;
  }

  private scheduleSave(room: Room) {
    if (!room.dirty) {
      room.dirty = true;
      room.firstDirtyAt = Date.now();
    }
    if (room.saveTimer) {
      clearTimeout(room.saveTimer);
    }
    // 계속 고치는 중이어도 너무 오래 저장을 미루지 않는다
    const wait =
      Date.now() - room.firstDirtyAt > MAX_SAVE_WAIT_MS ? 0 : SAVE_DELAY_MS;
    room.saveTimer = setTimeout(() => this.save(room), wait);
  }

  private async save(room: Room) {
    if (room.saveTimer) {
      clearTimeout(room.saveTimer);
      room.saveTimer = null;
    }
    if (!room.dirty) {
      return;
    }
    room.dirty = false;
    const snapshot = room.snapshot;
    room.snapshot = undefined;
    try {
      await this.docsService.saveYdoc(
        room.url,
        room.docId,
        Y.encodeStateAsUpdate(room.ydoc),
        room.lastEditorId,
        snapshot,
      );
      if (room.type === 'database') {
        await this.tasksService
          ?.indexDatabase(room.url, room.docId, room.ydoc, room.lastEditorId)
          .catch((error: Error) =>
            this.logger.warn(`할 일 목록을 적지 못했습니다: ${error.message}`),
          );
      }
    } catch (error) {
      this.logger.error(
        `문서 ${room.docId} 저장 실패: ${(error as Error).message}`,
      );
      room.dirty = true;
      room.snapshot = room.snapshot ?? snapshot;
      room.saveTimer = setTimeout(() => this.save(room), SAVE_DELAY_MS * 5);
    }
  }

  async handle(
    socket: Socket,
    user: { id: number },
    message: CollabMessage,
  ): Promise<void> {
    const docId = Number(message?.docId);
    if (!Number.isInteger(docId)) {
      return;
    }
    const url = socket.nsp.name.replace(/^\/ws-/, '');
    if (message.type === 'join') {
      let canEdit: boolean;
      let docType: string;
      try {
        const access = await this.docsService.collabAccess(url, docId, user.id);
        canEdit = access.canEdit;
        docType = access.doc.type;
      } catch {
        socket.emit('collab', { type: 'error', docId, reason: 'not-found' });
        return;
      }
      const room = await this.room(url, docId, docType);
      if (room.unloadTimer) {
        clearTimeout(room.unloadTimer);
        room.unloadTimer = null;
      }
      if (!room.sockets.has(socket.id)) {
        room.sockets.set(socket.id, new Set());
      }
      this.joined(socket).set(docId, { canEdit });
      if (canEdit) {
        room.editors.add(socket.id);
      }
      // 옮겨 넣을 사람이 아직 없으면 이 사람에게 맡긴다
      if (
        room.needsSeed &&
        canEdit &&
        (!room.seeder || !room.sockets.has(room.seeder))
      ) {
        room.seeder = socket.id;
      }
      socket.join(roomName(docId));
      socket.emit('collab', {
        type: 'sync',
        docId,
        canEdit,
        seed: room.needsSeed && room.seeder === socket.id,
        state: Y.encodeStateAsUpdate(room.ydoc),
        awareness: encodeAwarenessUpdate(room.awareness, [
          ...room.awareness.getStates().keys(),
        ]),
      });
      return;
    }
    const membership = this.joined(socket).get(docId);
    const room = this.rooms.get(docId);
    if (!membership || !room) {
      return;
    }
    switch (message.type) {
      case 'update': {
        const update = toBytes(message.update);
        if (!membership.canEdit || !update || update.length > MAX_UPDATE) {
          return;
        }
        try {
          Y.applyUpdate(room.ydoc, update, socket.id);
        } catch {
          return;
        }
        socket
          .to(roomName(docId))
          .emit('collab', { type: 'update', docId, update });
        // 내용이 들어왔으니 더 옮겨 넣지 않는다
        room.needsSeed = false;
        room.seeder = null;
        room.lastEditorId = user.id;
        this.scheduleSave(room);
        return;
      }
      case 'awareness': {
        const update = toBytes(message.update);
        if (!update || update.length > 64 * 1024) {
          return;
        }
        try {
          applyAwarenessUpdate(room.awareness, update, socket.id);
        } catch {
          return;
        }
        socket
          .to(roomName(docId))
          .emit('collab', { type: 'awareness', docId, update });
        return;
      }
      case 'snapshot': {
        if (
          !membership.canEdit ||
          typeof message.content !== 'string' ||
          message.content.length > MAX_SNAPSHOT
        ) {
          return;
        }
        room.snapshot = message.content;
        room.lastEditorId = user.id;
        this.scheduleSave(room);
        return;
      }
      case 'leave':
        this.leave(socket, docId);
        return;
      default:
    }
  }

  private leave(socket: Socket, docId: number) {
    this.joined(socket).delete(docId);
    socket.leave(roomName(docId));
    const room = this.rooms.get(docId);
    if (!room) {
      return;
    }
    const ids = room.sockets.get(socket.id);
    room.sockets.delete(socket.id);
    room.editors.delete(socket.id);
    // 옮겨 넣기로 한 사람이 넣기 전에 나가면 남은 사람에게 넘긴다
    if (room.needsSeed && room.seeder === socket.id) {
      room.seeder = [...room.editors][0] || null;
      if (room.seeder) {
        socket.nsp.sockets
          .get(room.seeder)
          ?.emit('collab', { type: 'seed', docId });
      }
    }
    if (ids?.size) {
      removeAwarenessStates(room.awareness, [...ids], 'server');
      socket.nsp.to(roomName(docId)).emit('collab', {
        type: 'awareness',
        docId,
        update: encodeAwarenessUpdate(room.awareness, [...ids]),
      });
    }
    if (!room.sockets.size) {
      // 마지막 사람이 나가면 바로 저장하고, 잠시 뒤 메모리에서 내린다
      void this.save(room);
      room.unloadTimer = setTimeout(async () => {
        if (room.sockets.size) {
          return;
        }
        await this.save(room);
        room.awareness.destroy();
        room.ydoc.destroy();
        this.rooms.delete(docId);
      }, UNLOAD_DELAY_MS);
    }
  }

  disconnect(socket: Socket) {
    const docs = socket.data.collab as Map<number, unknown> | undefined;
    docs?.forEach((_, docId) => this.leave(socket, docId));
  }
}
