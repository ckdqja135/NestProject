// 입력창에서 ↑ 를 누르면 내 마지막 메시지를 수정 모드로 연다 (메시지 컴포넌트가 구독)
type Listener = (id: number) => void;
const listeners = new Set<Listener>();

export const requestEdit = (id: number) => listeners.forEach((listener) => listener(id));

export const subscribeEditRequest = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// 열려 있는 모달/드롭다운이 없고 메시지를 수정 중이 아닐 때만 Esc 로 패널을 닫는다
export const canClosePanelWithEscape = (e: KeyboardEvent) =>
  e.key === 'Escape' &&
  !document.querySelector('[role="dialog"]') &&
  !(e.target instanceof HTMLElement && e.target.closest('[data-editing="true"]'));
