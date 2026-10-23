import { Socket } from 'socket.io-client';
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import * as Y from 'yjs';

// 실시간 동시 편집 연결: 서버의 문서 방에 들어가 Yjs 변경과 커서(awareness)를 주고받는다.
// 끊겼다 다시 연결되면 다시 들어가고, 그동안 고친 내용은 내 상태 전체를 보내서 합친다 (CRDT 라 겹쳐도 안전).

export type CollabStatus = 'connecting' | 'synced' | 'offline' | 'error';

export interface CollabUser {
  id: number;
  name: string;
  color: string;
}

const REMOTE = Symbol('remote');

const toBytes = (data: ArrayBuffer | Uint8Array) => (data instanceof Uint8Array ? data : new Uint8Array(data));

// 사람마다 다른 커서 색
export const COLLAB_COLORS = ['#e0405a', '#2f80ed', '#12a06b', '#e8891d', '#7c5cd6', '#d64a9b', '#17a2a8', '#b8860b'];
export const colorFor = (userId: number) => COLLAB_COLORS[userId % COLLAB_COLORS.length];

type Message =
  | { type: 'sync'; docId: number; canEdit: boolean; seed?: boolean; state: ArrayBuffer; awareness: ArrayBuffer }
  | { type: 'seed'; docId: number }
  | { type: 'update'; docId: number; update: ArrayBuffer }
  | { type: 'awareness'; docId: number; update: ArrayBuffer }
  | { type: 'error'; docId: number; reason: string };

export default class CollabProvider {
  readonly doc = new Y.Doc();

  readonly awareness = new Awareness(this.doc);

  status: CollabStatus = 'connecting';

  canEdit = false;

  synced = false;

  // 예전(마크다운) 문서를 블록으로 옮겨 넣을 차례인지 (서버가 한 사람에게만 맡긴다)
  shouldSeed = false;

  private listeners = new Set<() => void>();

  constructor(private socket: Socket, readonly docId: number, user: CollabUser) {
    this.awareness.setLocalStateField('user', user);
    this.doc.on('update', this.onDocUpdate);
    this.awareness.on('update', this.onAwarenessUpdate);
    socket.on('collab', this.onMessage);
    socket.on('connect', this.join);
    socket.on('disconnect', this.onDisconnect);
    if (socket.connected) this.join();
  }

  // 상태가 바뀌면 화면에 알린다
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setStatus(status: CollabStatus) {
    this.status = status;
    this.listeners.forEach((l) => l());
  }

  private join = () => {
    this.setStatus('connecting');
    this.socket.emit('collab', { type: 'join', docId: this.docId });
  };

  private onDisconnect = () => {
    this.synced = false;
    this.setStatus('offline');
    // 다른 사람들의 커서는 지운다 (다시 들어가면 새로 받는다)
    const others = Array.from(this.awareness.getStates().keys()).filter((id) => id !== this.doc.clientID);
    removeAwarenessStates(this.awareness, others, REMOTE);
  };

  private onMessage = (message: Message) => {
    if (message?.docId !== this.docId) return;
    if (message.type === 'error') {
      this.setStatus('error');
      return;
    }
    if (message.type === 'seed') {
      this.shouldSeed = true;
      this.listeners.forEach((l) => l());
      return;
    }
    if (message.type === 'sync') {
      this.canEdit = message.canEdit;
      this.shouldSeed = !!message.seed;
      Y.applyUpdate(this.doc, toBytes(message.state), REMOTE);
      applyAwarenessUpdate(this.awareness, toBytes(message.awareness), REMOTE);
      // 끊긴 동안 고친 내용까지 서버에 보낸다
      if (this.canEdit) {
        this.socket.emit('collab', { type: 'update', docId: this.docId, update: Y.encodeStateAsUpdate(this.doc) });
      }
      this.sendAwareness([this.doc.clientID]);
      this.synced = true;
      this.setStatus('synced');
      return;
    }
    if (message.type === 'update') {
      Y.applyUpdate(this.doc, toBytes(message.update), REMOTE);
      return;
    }
    if (message.type === 'awareness') {
      applyAwarenessUpdate(this.awareness, toBytes(message.update), REMOTE);
    }
  };

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE || !this.synced || !this.canEdit) return;
    this.socket.emit('collab', { type: 'update', docId: this.docId, update });
  };

  private sendAwareness(ids: number[]) {
    if (!this.socket.connected) return;
    this.socket.emit('collab', {
      type: 'awareness',
      docId: this.docId,
      update: encodeAwarenessUpdate(this.awareness, ids),
    });
  }

  private onAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === REMOTE) return;
    const mine = [...added, ...updated, ...removed].filter((id) => id === this.doc.clientID);
    if (mine.length && this.synced) this.sendAwareness(mine);
  };

  // 옮겨 넣기를 끝냈다 (다시 넣지 않게)
  seeded() {
    this.shouldSeed = false;
  }

  // 검색·미리보기용 글 (서버가 저장할 때 함께 쓴다)
  sendSnapshot(content: string) {
    if (this.canEdit && this.synced) {
      this.socket.emit('collab', { type: 'snapshot', docId: this.docId, content });
    }
  }

  destroy() {
    removeAwarenessStates(this.awareness, [this.doc.clientID], 'local');
    this.socket.emit('collab', { type: 'leave', docId: this.docId });
    this.socket.off('collab', this.onMessage);
    this.socket.off('connect', this.join);
    this.socket.off('disconnect', this.onDisconnect);
    this.doc.off('update', this.onDocUpdate);
    this.awareness.off('update', this.onAwarenessUpdate);
    this.awareness.destroy();
    this.doc.destroy();
    this.listeners.clear();
  }
}
