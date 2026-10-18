import { ICalendarEvent, IUser } from '@typings/db';
import dayjs, { Dayjs } from 'dayjs';

export type CalView = 'day' | 'week' | 'month';
export const VIEW_KEY = 'shlack-calendar-view';
export const HOUR_PX = 48;
export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 일정·캘린더 색 (이름 → 색)
export const COLORS: Record<string, string> = {
  blue: '#2f80ed',
  green: '#12a06b',
  orange: '#e8891d',
  red: '#e0405a',
  purple: '#7c5cd6',
  pink: '#d64a9b',
  teal: '#17a2a8',
  gray: '#6b7280',
};
export const COLOR_NAMES = Object.keys(COLORS);

export const readView = (): CalView => {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === 'day' || v === 'week' || v === 'month' ? v : 'week';
  } catch {
    return 'week';
  }
};

export const saveView = (view: CalView) => {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // 저장하지 못해도 이번 화면에서는 바뀐다
  }
};

// 내 캘린더는 파랑, 구독한 캘린더는 차례로 다른 색
export const calendarColorName = (userId: number, me: number, follows: IUser[]) => {
  if (userId === me) {
    return 'blue';
  }
  const index = follows.findIndex((f) => f.id === userId);
  return index < 0 ? 'gray' : COLOR_NAMES[(index + 1) % COLOR_NAMES.length];
};

export const eventColor = (event: ICalendarEvent, me: number, follows: IUser[]) => {
  if (event.color) {
    return COLORS[event.color] || event.color;
  }
  const calendar = event.calendars.includes(me) ? me : event.calendars[0] ?? me;
  return COLORS[calendarColorName(calendar, me, follows)];
};

export const startOfWeek = (d: Dayjs) => d.startOf('day').subtract(d.day(), 'day');

// 화면에 보이는 기간 [시작, 끝) — 월은 6주 격자 전체
export const rangeFor = (view: CalView, cursor: Dayjs): [Dayjs, Dayjs] => {
  if (view === 'month') {
    const start = startOfWeek(cursor.startOf('month'));
    return [start, start.add(42, 'day')];
  }
  if (view === 'week') {
    const start = startOfWeek(cursor);
    return [start, start.add(7, 'day')];
  }
  const start = cursor.startOf('day');
  return [start, start.add(1, 'day')];
};

export const monthGrid = (cursor: Dayjs) => {
  const start = startOfWeek(cursor.startOf('month'));
  return Array.from({ length: 42 }, (_, i) => start.add(i, 'day'));
};

export const overlapsDay = (event: ICalendarEvent, day: Dayjs) =>
  dayjs(event.startAt).isBefore(day.add(1, 'day')) && dayjs(event.endAt).isAfter(day);

// 종일이거나 자정을 넘기는 일정은 시간표 위 '종일' 줄에 둔다
export const isAllDayRow = (event: ICalendarEvent) =>
  event.allDay || !dayjs(event.startAt).isSame(dayjs(event.endAt).subtract(1, 'millisecond'), 'day');

export const fmtDay = (d: Dayjs) => `${d.format('M월 D일')} (${WEEKDAYS[d.day()]})`;

export const fmtWhen = (event: Pick<ICalendarEvent, 'startAt' | 'endAt' | 'allDay'>) => {
  const start = dayjs(event.startAt);
  const end = dayjs(event.endAt);
  if (event.allDay) {
    const last = end.subtract(1, 'millisecond');
    return start.isSame(last, 'day') ? `${fmtDay(start)} 종일` : `${fmtDay(start)} ~ ${fmtDay(last)}`;
  }
  return start.isSame(end, 'day')
    ? `${fmtDay(start)} ${start.format('HH:mm')} ~ ${end.format('HH:mm')}`
    : `${fmtDay(start)} ${start.format('HH:mm')} ~ ${fmtDay(end)} ${end.format('HH:mm')}`;
};

export const toInput = (d: Dayjs) => d.format('YYYY-MM-DDTHH:mm');
export const toDateInput = (d: Dayjs) => d.format('YYYY-MM-DD');

export const REMINDERS: [number | null, string][] = [
  [null, '알리지 않음'],
  [0, '시작할 때'],
  [5, '5분 전'],
  [10, '10분 전'],
  [15, '15분 전'],
  [30, '30분 전'],
  [60, '1시간 전'],
  [120, '2시간 전'],
  [1440, '1일 전'],
  [10080, '1주 전'],
];

export const STATUS_LABEL = { accepted: '참석', declined: '불참', pending: '응답 없음', owner: '주최' } as const;
export const STATUS_ICON = { accepted: '✅', declined: '❌', pending: '⏳', owner: '👑' } as const;

// 같은 시간대에 겹치는 일정을 옆으로 나란히 놓는다: 일정 id → (몇 번째 칸, 칸 수)
export function layoutColumns(events: ICalendarEvent[]) {
  const sorted = [...events].sort(
    (a, b) => +new Date(a.startAt) - +new Date(b.startAt) || +new Date(b.endAt) - +new Date(a.endAt),
  );
  const result = new Map<number, { col: number; cols: number }>();
  let cluster: { id: number; col: number }[] = [];
  let colEnds: number[] = [];
  let clusterEnd = 0;
  const flush = () => {
    cluster.forEach((c) => result.set(c.id, { col: c.col, cols: colEnds.length }));
    cluster = [];
    colEnds = [];
    clusterEnd = 0;
  };
  sorted.forEach((event) => {
    const start = +new Date(event.startAt);
    const end = +new Date(event.endAt);
    if (cluster.length && start >= clusterEnd) {
      flush();
    }
    let col = colEnds.findIndex((e) => e <= start);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(end);
    } else {
      colEnds[col] = end;
    }
    cluster.push({ id: event.id, col });
    clusterEnd = Math.max(clusterEnd, end);
  });
  flush();
  return result;
}
