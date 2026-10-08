// useSWRInfinite 의 첫 페이지 맨 앞에 채팅을 추가한다.
// 기존 배열을 직접 수정(unshift)하면 SWR 이 변경을 감지하지 못해 리렌더링되지 않으므로 새 배열을 반환한다.
const prependChat = <T>(pages: T[][] | undefined, chat: T): T[][] => {
  if (!pages || pages.length === 0) {
    return [[chat]];
  }
  return [[chat, ...pages[0]], ...pages.slice(1)];
};

export default prependChat;
