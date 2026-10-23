// 방해 금지 시간 (서버 backend/src/common/dnd.ts 와 같은 규칙).
// 밤을 넘기는 시간(22:00~08:00)은 시작한 요일 기준으로 다음 날 아침까지 이어진다.

export interface DndSchedule {
  on: boolean;
  start: string; // 'HH:mm'
  end: string;
  days: number[]; // 0(일) ~ 6(토)
  tz: string;
}

export const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const parseDnd = (raw: string | null | undefined): DndSchedule | null => {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value.start === 'string' ? value : null;
  } catch {
    return null;
  }
};

export const browserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const localNow = (tz: string, now: Date) => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
    return { day: WEEKDAYS.indexOf(get('weekday')), minutes: Number(get('hour')) * 60 + Number(get('minute')) };
  } catch {
    return { day: now.getDay(), minutes: now.getHours() * 60 + now.getMinutes() };
  }
};

export const isQuietNow = (schedule: DndSchedule | null, now = new Date()): boolean => {
  if (!schedule?.on || !schedule.days?.length) return false;
  const start = toMinutes(schedule.start);
  const end = toMinutes(schedule.end);
  if (start === end) return false;
  const { day, minutes } = localNow(schedule.tz, now);
  if (start < end) return schedule.days.includes(day) && minutes >= start && minutes < end;
  const yesterday = (day + 6) % 7;
  return (schedule.days.includes(day) && minutes >= start) || (schedule.days.includes(yesterday) && minutes < end);
};

// 이 기기에서 알림을 띄울 때 쓰는 내 방해 금지 시간 (레이아웃이 계정 설정에서 넣는다)
let mine: DndSchedule | null = null;
export const setMyDnd = (schedule: DndSchedule | null) => {
  mine = schedule;
};
export const myQuietNow = () => isQuietNow(mine);
