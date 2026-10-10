import { subscribeUnread, totalUnread } from '@utils/unreadStore';
import { useEffect } from 'react';

const BASE_TITLE = '슐랙';

// 탭 제목에 안 읽은 수를 표시한다: "(3) 슐랙"
export default function useUnreadTitle() {
  useEffect(() => {
    const update = () => {
      const total = totalUnread();
      document.title = total > 0 ? `(${total > 99 ? '99+' : total}) ${BASE_TITLE}` : BASE_TITLE;
    };
    update();
    const unsubscribe = subscribeUnread(update);
    return () => {
      unsubscribe();
      document.title = BASE_TITLE;
    };
  }, []);
}
