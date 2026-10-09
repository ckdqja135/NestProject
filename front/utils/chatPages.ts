// useSWRInfinite 의 페이지 배열(최신 메시지가 앞)을 불변으로 갱신하는 헬퍼들
type WithId = { id: number };

export const updateChatInPages = <T extends WithId>(
  pages: T[][] | undefined,
  id: number,
  updater: (chat: T) => T,
): T[][] | undefined => {
  if (!pages) {
    return pages;
  }
  let changed = false;
  const next = pages.map((page) =>
    page.map((chat) => {
      if (chat.id !== id) {
        return chat;
      }
      changed = true;
      return updater(chat);
    }),
  );
  return changed ? next : pages;
};

export const removeChatFromPages = <T extends WithId>(pages: T[][] | undefined, id: number): T[][] | undefined => {
  if (!pages) {
    return pages;
  }
  return pages.map((page) => page.filter((chat) => chat.id !== id));
};

// 낙관적 업데이트용 임시 id (서버 id 와 겹치지 않도록 음수)
let tempSeq = 0;
export const createTempId = () => -(Date.now() * 100 + (tempSeq++ % 100));
export const isTempId = (id: number) => id < 0;
