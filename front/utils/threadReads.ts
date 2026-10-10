// 스레드별로 마지막으로 읽은 시각 (이 기기에만 저장). 스레드 모아 보기의 '새 답글' 표시에 쓴다.
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

export const markThreadRead = (parentId: number) => {
  try {
    const reads = load();
    reads[parentId] = Date.now();
    localStorage.setItem(THREAD_READS_KEY, JSON.stringify(reads));
  } catch {
    // 저장소를 쓸 수 없으면 읽음 표시를 하지 않는다
  }
  listeners.forEach((listener) => listener());
};

export const subscribeThreadReads = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
