import { RefObject, useEffect, useRef } from 'react';
import { Scrollbars } from 'react-custom-scrollbars-2';
import { useHistory, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';

// 너무 오래된 메시지를 찾느라 끝없이 불러오지 않도록 제한
const MAX_PAGES = 30;

// 화면에 그려진 메시지를 가운데로 스크롤하고 잠깐 강조한다 (스레드 패널처럼 늦게 그려지는 곳은 잠시 기다린다)
export const highlightMessage = (id: number, tries = 15) => {
  const element = document.querySelector<HTMLElement>(`[data-chat-id="${id}"]`);
  if (!element) {
    if (tries > 0) {
      setTimeout(() => highlightMessage(id, tries - 1), 200);
    }
    return;
  }
  element.scrollIntoView({ block: 'center' });
  element.classList.add('highlight');
  setTimeout(() => element.classList.remove('highlight'), 2500);
};

interface Options<T extends { id: number }> {
  pages?: T[][];
  isReachingEnd?: boolean;
  setSize: (f: (size: number) => number) => Promise<unknown>;
  scrollbarRef: RefObject<Scrollbars>;
  // 스레드 답글로 이동할 때 원본 메시지를 찾은 뒤 스레드를 연다
  onOpenThread?: (parentId: number) => void;
}

// 주소의 ?message=<id>(&reply=<답글 id>) 를 읽어 그 메시지가 나올 때까지 이전 메시지를 불러온 뒤 그 위치로 이동한다
export default function useJumpToMessage<T extends { id: number }>({
  pages,
  isReachingEnd,
  setSize,
  scrollbarRef,
  onOpenThread,
}: Options<T>) {
  const location = useLocation();
  const history = useHistory();
  const params = new URLSearchParams(location.search);
  const messageId = Number(params.get('message')) || null;
  const replyId = Number(params.get('reply')) || null;
  const requested = useRef(0);

  useEffect(() => {
    requested.current = 0;
  }, [messageId]);

  useEffect(() => {
    if (!messageId || !pages || !scrollbarRef.current) {
      return;
    }
    const finish = () => history.replace(location.pathname);
    if (pages.some((page) => page.some((chat) => chat.id === messageId))) {
      finish();
      // 첫 페이지 로딩 후의 맨 아래 스크롤보다 늦게 이동해야 한다
      setTimeout(() => highlightMessage(messageId), 300);
      if (replyId && onOpenThread) {
        onOpenThread(messageId);
        setTimeout(() => highlightMessage(replyId), 300);
      }
      return;
    }
    if (isReachingEnd || pages.length >= MAX_PAGES) {
      finish();
      toast.info('메시지를 찾을 수 없습니다. 삭제되었을 수 있습니다.', { position: 'bottom-center' });
      return;
    }
    // 같은 페이지를 여러 번 요청하지 않도록, 요청한 페이지가 도착했을 때만 다음 페이지를 부른다
    if (requested.current <= pages.length) {
      requested.current = pages.length + 1;
      setSize(() => pages.length + 1);
    }
  }, [messageId, pages, isReachingEnd, setSize, scrollbarRef, replyId, onOpenThread, history, location.pathname]);
}
