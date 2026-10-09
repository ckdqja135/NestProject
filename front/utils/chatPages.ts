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

// useSWRInfinite 키: 이전 페이지의 가장 오래된 (서버에 저장된) 메시지 id 를 커서로 쓴다.
// page 번호 방식은 새 메시지가 들어오면 페이지 경계가 밀려 같은 메시지가 중복되므로 쓰지 않는다.
export const cursorPageKey =
  (baseUrl: string, pageSize: number) =>
  (index: number, previousPage: WithId[] | null): string | null => {
    if (index === 0) {
      return `${baseUrl}?perPage=${pageSize}`;
    }
    if (!previousPage || previousPage.length === 0) {
      return null;
    }
    // 낙관적 업데이트로 들어간 임시 메시지(음수 id)는 커서로 쓸 수 없다
    const oldest = [...previousPage].reverse().find((chat) => !isTempId(chat.id));
    return oldest ? `${baseUrl}?perPage=${pageSize}&beforeId=${oldest.id}` : null;
  };
