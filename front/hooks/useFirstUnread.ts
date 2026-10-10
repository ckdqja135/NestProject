import { RefObject, useEffect, useMemo, useRef } from 'react';
import { Scrollbars } from 'react-custom-scrollbars-2';
import { useLocation } from 'react-router-dom';

interface Chatlike {
  id: number;
  createdAt: Date | string;
}

// 대화에 들어오기 전 마지막으로 읽은 시각(localStorage `${workspace}-${대화}`) 이후에 남이 보낸 첫 메시지.
// 들어올 때 읽은 시각이 바로 갱신되므로, 대화가 바뀔 때 한 번만 읽어 둔다.
// 안 읽은 메시지가 첫 페이지보다 많으면 경계를 찾을 때까지 이전 페이지를 더 불러온다 (최대)
const MAX_PAGES = 5;

export default function useFirstUnread<T extends Chatlike>(
  readKey: string,
  pages: T[][] | undefined,
  isMine: (chat: T) => boolean,
  scrollbarRef: RefObject<Scrollbars>,
  isReachingEnd: boolean | undefined,
  setSize: (f: (size: number) => number) => Promise<unknown>,
) {
  const location = useLocation();
  const lastRead = useMemo(() => {
    try {
      return Number(localStorage.getItem(readKey)) || 0;
    } catch {
      return 0;
    }
  }, [readKey]);

  // 불러온 것 중 가장 오래된 메시지도 안 읽은 것이면 경계가 더 이전 페이지에 있다
  const needsMore =
    !!lastRead &&
    !!pages &&
    !isReachingEnd &&
    pages.length < MAX_PAGES &&
    (() => {
      const oldest = pages[pages.length - 1]?.[pages[pages.length - 1].length - 1];
      return !!oldest && new Date(oldest.createdAt).getTime() > lastRead;
    })();

  const requested = useRef(0);
  useEffect(() => {
    requested.current = 0;
  }, [readKey]);
  useEffect(() => {
    if (needsMore && pages && requested.current <= pages.length) {
      requested.current = pages.length + 1;
      setSize(() => pages.length + 1);
    }
  }, [needsMore, pages, setSize]);

  const firstUnreadId = useMemo(() => {
    // 처음 들어온 대화면 전부 새 메시지이므로 구분선을 그리지 않는다
    if (!lastRead || !pages || needsMore) {
      return null;
    }
    const chats = ([] as T[]).concat(...pages).reverse();
    const first = chats.find((chat) => new Date(chat.createdAt).getTime() > lastRead && !isMine(chat));
    return first ? first.id : null;
  }, [lastRead, pages, isMine, needsMore]);

  // 처음 불러왔을 때 구분선이 있으면 그 위치로 스크롤 (메시지로 이동 중이면 그쪽이 우선)
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!pages || needsMore || scrolledFor.current === readKey || new URLSearchParams(location.search).get('message')) {
      return;
    }
    scrolledFor.current = readKey;
    if (!firstUnreadId) {
      return;
    }
    // 첫 페이지 로딩 후의 맨 아래 스크롤보다 늦게 이동한다
    setTimeout(() => {
      document.querySelector('.new-divider')?.scrollIntoView({ block: 'start' });
      if (scrollbarRef.current && scrollbarRef.current.getScrollTop() > 0) {
        scrollbarRef.current.scrollTop(scrollbarRef.current.getScrollTop() - 40);
      }
    }, 200);
  }, [pages, needsMore, readKey, firstUnreadId, location.search, scrollbarRef]);

  return firstUnreadId;
}
