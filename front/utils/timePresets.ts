import dayjs from 'dayjs';

// 예약 전송·리마인더에서 고르는 시각
export const timePresets = () => {
  const now = dayjs();
  const tomorrow9 = now.add(1, 'day').hour(9).minute(0).second(0).millisecond(0);
  // 다음 주 월요일 오전 9시
  const nextMonday = now
    .add((8 - now.day()) % 7 || 7, 'day')
    .hour(9)
    .minute(0)
    .second(0)
    .millisecond(0);
  return [
    { label: '30분 후', date: now.add(30, 'minute').toDate() },
    { label: '1시간 후', date: now.add(1, 'hour').toDate() },
    { label: '3시간 후', date: now.add(3, 'hour').toDate() },
    { label: `내일 오전 9시 (${tomorrow9.format('M/D')})`, date: tomorrow9.toDate() },
    { label: `다음 주 월요일 오전 9시 (${nextMonday.format('M/D')})`, date: nextMonday.toDate() },
  ];
};

export const formatWhen = (date: Date | string) =>
  dayjs(date).format('M월 D일 A h:mm').replace('AM', '오전').replace('PM', '오후');
