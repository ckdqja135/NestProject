import axios from 'axios';
import { applyThreadRead } from '@utils/threadReads';

// 채널·DM 을 어디까지 읽었는지. 이 기기(localStorage `${워크스페이스}-${채널이름 또는 상대id}`)에 바로 적고,
// 서버(read-markers)에도 보내서 다른 기기와 맞춘다. 서버 키: c:채널id, d:상대id, t:스레드 원본 메시지id
export type ReadTarget = { channel: string } | { dm: number };

type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((listener) => listener());

// 사이드바(안 읽은 수, 임시 저장 표시)를 다시 그리게 한다
export const refreshSidebar = () => notify();

export const subscribeReadState = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// 서버 키는 채널 id 를 쓰므로 워크스페이스별 채널 이름 → id 를 알아 둔다
const channelIds: Record<string, Record<string, number>> = {};
// 채널 목록을 받기 전에 읽은 채널은 목록을 받은 뒤 서버에 보낸다
const waitingForIds: Record<string, Record<string, number>> = {};

const localKey = (workspace: string, target: ReadTarget) =>
  'channel' in target ? `${workspace}-${target.channel}` : `${workspace}-${target.dm}`;

const read = (key: string) => {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
};

const write = (key: string, at: number) => {
  try {
    localStorage.setItem(key, String(at));
  } catch {
    // 저장소를 쓸 수 없으면 서버에만 남긴다
  }
};

export const getLastRead = (workspace: string, target: ReadTarget) => read(localKey(workspace, target));

// 서버로 보내기 (같은 대화를 연달아 읽으면 1초에 한 번만)
const pending = new Map<string, { workspace: string; key: string; at: number }>();
let timer: ReturnType<typeof setTimeout> | null = null;
const flush = () => {
  timer = null;
  pending.forEach(({ workspace, key, at }) => {
    axios.put(`/api/workspaces/${workspace}/read-markers`, { key, at }).catch(() => undefined);
  });
  pending.clear();
};
export const queueReadMarker = (workspace: string, key: string, at: number) => {
  pending.set(`${workspace}|${key}`, { workspace, key, at });
  if (!timer) {
    timer = setTimeout(flush, 1000);
  }
};

export const markRead = (workspace: string, target: ReadTarget) => {
  const at = Date.now();
  write(localKey(workspace, target), at);
  if ('dm' in target) {
    queueReadMarker(workspace, `d:${target.dm}`, at);
  } else {
    const id = channelIds[workspace]?.[target.channel];
    if (id) {
      queueReadMarker(workspace, `c:${id}`, at);
    } else {
      waitingForIds[workspace] = { ...waitingForIds[workspace], [target.channel]: at };
    }
  }
  notify();
};

export const registerChannels = (workspace: string, channels: { id: number; name: string }[]) => {
  channelIds[workspace] = Object.fromEntries(channels.map((c) => [c.name, c.id]));
  Object.entries(waitingForIds[workspace] || {}).forEach(([name, at]) => {
    const id = channelIds[workspace][name];
    if (id) {
      queueReadMarker(workspace, `c:${id}`, at);
    }
  });
  delete waitingForIds[workspace];
};

// 서버(다른 기기)에서 온 읽은 위치를 이 기기에 반영한다 (더 나중 것만)
export const applyReadMarker = (workspace: string, key: string, at: number) => {
  const [kind, rawId] = key.split(':');
  const id = Number(rawId);
  if (kind === 't') {
    applyThreadRead(id, at);
    return;
  }
  let target: ReadTarget | null = null;
  if (kind === 'd') {
    target = { dm: id };
  } else if (kind === 'c') {
    const name = Object.entries(channelIds[workspace] || {}).find(([, channelId]) => channelId === id)?.[0];
    target = name ? { channel: name } : null;
  }
  if (!target) {
    return;
  }
  const local = localKey(workspace, target);
  if (at > read(local)) {
    write(local, at);
    notify();
  }
};
