import { BadRequestException, ForbiddenException } from '@nestjs/common';

// 투표 메시지: 내용은 poll:{"q":질문,"o":[선택지...],"m":여러 개 선택 여부,"c":마감 여부}
// 투표는 선택지 번호 이모지 리액션으로 한다 (프론트 utils/poll.ts 와 같은 형식)
export const POLL_EMOJIS = [
  '1️⃣',
  '2️⃣',
  '3️⃣',
  '4️⃣',
  '5️⃣',
  '6️⃣',
  '7️⃣',
  '8️⃣',
  '9️⃣',
  '🔟',
];

export interface Poll {
  q: string;
  o: string[];
  m?: boolean; // false 면 하나만 고를 수 있다 (없으면 여러 개)
  c?: boolean; // true 면 마감
}

export function parsePoll(content: string): Poll | null {
  if (!content?.startsWith('poll:')) {
    return null;
  }
  try {
    const poll = JSON.parse(content.slice(5));
    return typeof poll?.q === 'string' && Array.isArray(poll.o) ? poll : null;
  } catch {
    return null;
  }
}

export const toPollContent = (poll: Poll) => `poll:${JSON.stringify(poll)}`;

// 투표 리액션 규칙. 하나만 고르는 투표면 지워야 할 내 다른 선택지 이모지를 돌려준다.
export function checkPollVote(
  content: string,
  emoji: string,
  myEmojis: string[],
): string[] {
  const poll = parsePoll(content);
  const index = POLL_EMOJIS.indexOf(emoji);
  if (!poll || index === -1) {
    return [];
  }
  if (poll.c) {
    throw new ForbiddenException('마감된 투표입니다.');
  }
  if (index >= poll.o.length) {
    throw new BadRequestException('없는 선택지입니다.');
  }
  if (poll.m === false && !myEmojis.includes(emoji)) {
    return myEmojis.filter((e) => e !== emoji && POLL_EMOJIS.includes(e));
  }
  return [];
}
