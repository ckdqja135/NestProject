// 스레드별로 마지막으로 읽은 시각. 스레드 모아 보기의 '새 답글' 표시에 쓴다.
// 이 기기에 바로 적고 서버(read-markers 의 t:원본 메시지id)에도 보내 다른 기기와 맞춘다.
export const THREAD_READS_KEY = 'shlack-thread-reads';

type Listener = () => void;
const listeners = new Set<Listener>();

const load = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(THREAD_READS_KEY) || '{}');
  } catch {
    return {};
  }
};

export const getThreadRead = (parentId: number) => load()[parentId] || 0;

const save = (parentId: number, at: number) => {
  try {
    const reads = load();
    reads[parentId] = at;
    localStorage.setItem(THREAD_READS_KEY, JSON.stringify(reads));
  } catch {
    // 저장소를 쓸 수 없으면 이 기기에는 남기지 않는다
  }
  listeners.forEach((listener) => listener());
};

export const markThreadRead = (parentId: number, workspace?: string) => {
  const at = Date.now();
  save(parentId, at);
  if (workspace) {
    // 순환 참조를 피하려고 필요할 때 불러온다
    import('@utils/readState').then(({ queueReadMarker }) => queueReadMarker(workspace, `t:${parentId}`, at));
  }
};

// 다른 기기에서 읽은 스레드 (더 나중 것만)
export const applyThreadRead = (parentId: number, at: number) => {
  if (at > getThreadRead(parentId)) {
    save(parentId, at);
  }
};

export const subscribeThreadReads = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
