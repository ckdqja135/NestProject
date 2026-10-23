// 허들(여러 명 음성·화상 통화)의 참여자 상태. 서버 한 대에서 메모리에만 둔다.
// 허들은 채널(ch-번호)·문서(doc-번호)·캘린더 일정(ev-번호) 중 하나에 딸린다 (scope).
// 음성·영상은 참여자 브라우저끼리 직접 주고받고(WebRTC 메시), 서버는 누가 있는지와 연결 신호만 다룬다.

// 브라우저끼리 모두 직접 연결하므로 사람이 많아지면 버거워진다
export const MAX_HUDDLE_MEMBERS = 6;

export interface HuddleMember {
  userId: number;
  socketId: string;
  muted: boolean;
  video: boolean;
  sharing: boolean;
  // 받는 쪽이 어떤 영상이 카메라이고 어떤 것이 화면 공유인지 구분하도록 스트림 id 를 알린다
  cameraStream: string | null;
  screenStream: string | null;
  joinedAt: number;
}

export const SCOPE_PATTERN = /^(ch|doc|ev)-(\d{1,10})$/;

export interface Huddle {
  scope: string;
  startedAt: number;
  members: Map<number, HuddleMember>;
}

export interface HuddleView {
  scope: string;
  startedAt: number;
  members: Omit<HuddleMember, 'socketId'>[];
}

export type HuddleMediaState = Partial<
  Pick<
    HuddleMember,
    'muted' | 'video' | 'sharing' | 'cameraStream' | 'screenStream'
  >
>;

const STREAM_ID = /^[\w{}-]{1,100}$/;

export class HuddleStore {
  // 네임스페이스(워크스페이스) → scope → 허들
  private huddles = new Map<string, Map<string, Huddle>>();

  private of(namespace: string) {
    let map = this.huddles.get(namespace);
    if (!map) {
      map = new Map();
      this.huddles.set(namespace, map);
    }
    return map;
  }

  get(namespace: string, scope: string) {
    return this.huddles.get(namespace)?.get(scope);
  }

  // 이 소켓이 들어가 있는 허들
  findBySocket(namespace: string, socketId: string) {
    for (const huddle of this.huddles.get(namespace)?.values() || []) {
      for (const member of huddle.members.values()) {
        if (member.socketId === socketId) {
          return { huddle, member };
        }
      }
    }
    return undefined;
  }

  findByUser(namespace: string, userId: number) {
    for (const huddle of this.huddles.get(namespace)?.values() || []) {
      const member = huddle.members.get(userId);
      if (member) {
        return { huddle, member };
      }
    }
    return undefined;
  }

  // 참여. 같은 사람이 다른 탭이나 다른 채널 허들에 있었으면 그쪽에서 빼고 넣는다.
  join(
    namespace: string,
    scope: string,
    userId: number,
    socketId: string,
    now = Date.now(),
  ):
    | {
        huddle: Huddle;
        replacedSocketId: string | null;
        left: Huddle | null;
        started: boolean;
      }
    | 'full' {
    const current = this.get(namespace, scope);
    const already = current?.members.get(userId);
    if (current && !already && current.members.size >= MAX_HUDDLE_MEMBERS) {
      return 'full';
    }
    const previous = this.findByUser(namespace, userId);
    let left: Huddle | null = null;
    let replacedSocketId: string | null = null;
    if (previous && previous.huddle.scope !== scope) {
      left = this.removeMember(namespace, previous.huddle, userId);
      replacedSocketId =
        previous.member.socketId !== socketId ? previous.member.socketId : null;
    } else if (already && already.socketId !== socketId) {
      replacedSocketId = already.socketId;
    }
    const map = this.of(namespace);
    let huddle = map.get(scope);
    const started = !huddle;
    if (!huddle) {
      huddle = { scope, startedAt: now, members: new Map() };
      map.set(scope, huddle);
    }
    huddle.members.set(userId, {
      userId,
      socketId,
      muted: false,
      video: false,
      sharing: false,
      cameraStream: null,
      screenStream: null,
      joinedAt: now,
    });
    return { huddle, replacedSocketId, left, started };
  }

  private removeMember(namespace: string, huddle: Huddle, userId: number) {
    huddle.members.delete(userId);
    if (!huddle.members.size) {
      this.huddles.get(namespace)?.delete(huddle.scope);
    }
    return huddle;
  }

  // 이 소켓을 허들에서 뺀다 (나가기, 연결 끊김). 빠진 허들을 돌려준다.
  leaveBySocket(namespace: string, socketId: string) {
    const found = this.findBySocket(namespace, socketId);
    if (!found) {
      return undefined;
    }
    return this.removeMember(namespace, found.huddle, found.member.userId);
  }

  // 채널에서 나간 사람 등: 이 채널 허들에서 뺀다
  leaveScope(namespace: string, scope: string, userId: number) {
    const huddle = this.get(namespace, scope);
    if (!huddle?.members.has(userId)) {
      return undefined;
    }
    return this.removeMember(namespace, huddle, userId);
  }

  setState(namespace: string, socketId: string, state: HuddleMediaState) {
    const found = this.findBySocket(namespace, socketId);
    if (!found) {
      return undefined;
    }
    const { member } = found;
    (['muted', 'video', 'sharing'] as const).forEach((key) => {
      if (typeof state[key] === 'boolean') {
        member[key] = state[key] as boolean;
      }
    });
    (['cameraStream', 'screenStream'] as const).forEach((key) => {
      const value = state[key];
      if (
        value === null ||
        (typeof value === 'string' && STREAM_ID.test(value))
      ) {
        member[key] = value;
      }
    });
    return found.huddle;
  }

  // 지금 진행 중인 허들 (이 scope 들 것만)
  list(namespace: string, scopes: Set<string>) {
    return [...(this.huddles.get(namespace)?.values() || [])]
      .filter((h) => scopes.has(h.scope))
      .map((h) => HuddleStore.view(h));
  }

  static view(huddle: Huddle): HuddleView {
    return {
      scope: huddle.scope,
      startedAt: huddle.startedAt,
      members: [...huddle.members.values()]
        .sort((a, b) => a.joinedAt - b.joinedAt)
        // 소켓 id 는 다른 사람에게 알리지 않는다
        .map((member) => ({
          userId: member.userId,
          muted: member.muted,
          video: member.video,
          sharing: member.sharing,
          cameraStream: member.cameraStream,
          screenStream: member.screenStream,
          joinedAt: member.joinedAt,
        })),
    };
  }
}

export const huddleStore = new HuddleStore();
