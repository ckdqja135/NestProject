// 사이드바의 채널/DM 별 안 읽은 수를 모아 탭 제목에 보여주기 위한 작은 저장소
type Listener = () => void;

const counts = new Map<string, number>();
const listeners = new Set<Listener>();

export const setUnread = (key: string, count: number) => {
  if ((counts.get(key) || 0) === count) {
    return;
  }
  if (count > 0) {
    counts.set(key, count);
  } else {
    counts.delete(key);
  }
  listeners.forEach((listener) => listener());
};

export const totalUnread = () => {
  let total = 0;
  counts.forEach((count) => {
    total += count;
  });
  return total;
};

export const subscribeUnread = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
