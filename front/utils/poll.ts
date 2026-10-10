// 투표 메시지: 내용은 poll:{"q":"질문","o":["선택지",...]} 이고, 투표는 선택지 번호 이모지 리액션으로 한다
export const POLL_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
export const MAX_POLL_OPTIONS = POLL_EMOJIS.length;

export interface Poll {
  q: string;
  o: string[];
}

export const toPollContent = (poll: Poll) => `poll:${JSON.stringify(poll)}`;

export const parsePollContent = (content: string): Poll | null => {
  if (!content.startsWith('poll:')) {
    return null;
  }
  try {
    const poll = JSON.parse(content.slice(5));
    if (
      typeof poll?.q === 'string' &&
      Array.isArray(poll.o) &&
      poll.o.length >= 2 &&
      poll.o.length <= MAX_POLL_OPTIONS &&
      poll.o.every((option: unknown) => typeof option === 'string')
    ) {
      return poll;
    }
  } catch {
    // 형식이 맞지 않으면 그냥 글로 보여준다
  }
  return null;
};
