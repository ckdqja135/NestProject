import { isQuietNow } from './dnd';

describe('방해 금지 시간', () => {
  const night = {
    on: true,
    start: '22:00',
    end: '08:00',
    days: [1, 2, 3, 4, 5], // 월~금 밤
    tz: 'Asia/Seoul',
  };
  // 2026-10-19 은 월요일
  const at = (iso: string) => new Date(`${iso}+09:00`);

  it('밤을 넘기는 시간은 다음 날 아침까지 이어진다', () => {
    expect(isQuietNow(night, at('2026-10-19T23:00:00'))).toBe(true);
    expect(isQuietNow(night, at('2026-10-20T07:59:00'))).toBe(true);
    expect(isQuietNow(night, at('2026-10-20T08:00:00'))).toBe(false);
    expect(isQuietNow(night, at('2026-10-19T21:59:00'))).toBe(false);
  });

  it('고르지 않은 요일에는 조용하지 않다 (일요일 밤, 그 다음 월요일 새벽)', () => {
    expect(isQuietNow(night, at('2026-10-18T23:00:00'))).toBe(false);
    expect(isQuietNow(night, at('2026-10-19T03:00:00'))).toBe(false);
    // 금요일 밤에 시작한 것은 토요일 새벽까지
    expect(isQuietNow(night, at('2026-10-24T03:00:00'))).toBe(true);
  });

  it('하루 안의 시간대, 꺼 둔 경우', () => {
    const lunch = {
      ...night,
      start: '12:00',
      end: '13:00',
      days: [0, 1, 2, 3, 4, 5, 6],
    };
    expect(isQuietNow(lunch, at('2026-10-21T12:30:00'))).toBe(true);
    expect(isQuietNow(lunch, at('2026-10-21T13:00:00'))).toBe(false);
    expect(isQuietNow({ ...lunch, on: false }, at('2026-10-21T12:30:00'))).toBe(
      false,
    );
  });

  it('시간대가 다르면 그 시간대 기준으로 본다', () => {
    const utc = { ...night, tz: 'UTC' };
    // 서울 2026-10-20 07:00 = UTC 10-19 22:00 (월요일 밤) → 조용
    expect(isQuietNow(utc, at('2026-10-20T07:00:00'))).toBe(true);
  });
});
