import { HuddleStore, MAX_HUDDLE_MEMBERS } from './huddles';

describe('HuddleStore', () => {
  const ns = '/ws-shlack';
  let store: HuddleStore;
  beforeEach(() => {
    store = new HuddleStore();
  });

  it('처음 들어온 사람이 허들을 시작하고, 마지막 사람이 나가면 끝난다', () => {
    const first = store.join(ns, 1, 10, 'a', 1000);
    expect(first).not.toBe('full');
    store.join(ns, 1, 11, 'b', 2000);
    expect(HuddleStore.view(store.get(ns, 1)!)).toMatchObject({
      channelId: 1,
      startedAt: 1000,
      members: [{ userId: 10 }, { userId: 11 }],
    });
    store.leaveBySocket(ns, 'a');
    expect(store.get(ns, 1)?.members.size).toBe(1);
    const ended = store.leaveBySocket(ns, 'b');
    expect(ended?.members.size).toBe(0);
    expect(store.get(ns, 1)).toBeUndefined();
  });

  it(`${MAX_HUDDLE_MEMBERS}명이 차면 더 들어올 수 없다 (이미 있던 사람의 새 탭은 된다)`, () => {
    for (let i = 0; i < MAX_HUDDLE_MEMBERS; i += 1) {
      store.join(ns, 1, i, `s${i}`);
    }
    expect(store.join(ns, 1, 99, 'x')).toBe('full');
    const again = store.join(ns, 1, 0, 'new-tab');
    expect(again).not.toBe('full');
    if (again !== 'full') {
      expect(again.replacedSocketId).toBe('s0');
    }
  });

  it('다른 채널 허들로 옮기면 원래 허들에서 빠진다', () => {
    store.join(ns, 1, 10, 'a');
    store.join(ns, 1, 11, 'b');
    const moved = store.join(ns, 2, 10, 'a');
    expect(moved).not.toBe('full');
    if (moved !== 'full') {
      expect(moved.left?.channelId).toBe(1);
      expect(moved.replacedSocketId).toBeNull();
    }
    expect([...store.get(ns, 1)!.members.keys()]).toEqual([11]);
    expect([...store.get(ns, 2)!.members.keys()]).toEqual([10]);
  });

  it('마이크·카메라 상태를 바꾸고, 이상한 값은 무시한다', () => {
    store.join(ns, 1, 10, 'a');
    store.setState(ns, 'a', {
      muted: true,
      video: true,
      cameraStream: 'abc-123',
      screenStream: '<script>' as string,
    });
    const view = HuddleStore.view(store.get(ns, 1)!);
    expect(view.members[0]).toMatchObject({
      muted: true,
      video: true,
      cameraStream: 'abc-123',
      screenStream: null,
    });
    expect(view.members[0]).not.toHaveProperty('socketId');
  });

  it('참여 중인 채널의 허들만 목록에 보인다', () => {
    store.join(ns, 1, 10, 'a');
    store.join(ns, 2, 11, 'b');
    expect(store.list(ns, new Set([2])).map((h) => h.channelId)).toEqual([2]);
    expect(store.list('/ws-other', new Set([1, 2]))).toEqual([]);
  });
});
