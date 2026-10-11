import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { checkPollVote, toPollContent } from './poll';

describe('투표 규칙', () => {
  const multi = toPollContent({
    q: '점심?',
    o: ['김치찌개', '돈까스', '국수'],
  });
  const single = toPollContent({
    q: '점심?',
    o: ['김치찌개', '돈까스'],
    m: false,
  });
  const closed = toPollContent({
    q: '점심?',
    o: ['김치찌개', '돈까스'],
    c: true,
  });

  it('투표가 아니거나 선택지 이모지가 아니면 아무 제한이 없다', () => {
    expect(checkPollVote('그냥 메시지', '1️⃣', [])).toEqual([]);
    expect(checkPollVote(multi, '👍', ['1️⃣'])).toEqual([]);
  });

  it('여러 개 고르는 투표는 다른 선택을 지우지 않는다', () => {
    expect(checkPollVote(multi, '2️⃣', ['1️⃣'])).toEqual([]);
  });

  it('하나만 고르는 투표는 내 다른 선택을 지운다 (취소할 때는 그대로)', () => {
    expect(checkPollVote(single, '2️⃣', ['1️⃣', '👍'])).toEqual(['1️⃣']);
    expect(checkPollVote(single, '1️⃣', ['1️⃣'])).toEqual([]);
  });

  it('마감된 투표나 없는 선택지는 막는다', () => {
    expect(() => checkPollVote(closed, '1️⃣', [])).toThrow(ForbiddenException);
    expect(() => checkPollVote(multi, '4️⃣', [])).toThrow(BadRequestException);
  });
});
