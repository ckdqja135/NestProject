// 방해 금지 시간: 정한 요일·시간대에는 알림(푸시·데스크톱)을 보내지 않는다.
// 밤을 넘기는 시간(22:00~08:00)은 시작한 요일 기준으로 다음 날 아침까지 이어진다.

export interface DndSchedule {
  on: boolean;
  start: string; // 'HH:mm'
  end: string; // 'HH:mm'
  days: number[]; // 0(일) ~ 6(토)
  tz: string; // 'Asia/Seoul' 같은 시간대 이름
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const parseDnd = (
  raw: string | null | undefined,
): DndSchedule | null => {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value.start === 'string' ? value : null;
  } catch {
    return null;
  }
};

// 그 시간대에서 지금의 요일과 하루 중 분
const localNow = (tz: string, now: Date) => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value || '';
    return {
      day: WEEKDAYS.indexOf(get('weekday')),
      minutes: Number(get('hour')) * 60 + Number(get('minute')),
    };
  } catch {
    return {
      day: now.getDay(),
      minutes: now.getHours() * 60 + now.getMinutes(),
    };
  }
};

export const isQuietNow = (
  schedule: DndSchedule | null,
  now = new Date(),
): boolean => {
  if (!schedule?.on || !schedule.days?.length) return false;
  const start = toMinutes(schedule.start);
  const end = toMinutes(schedule.end);
  if (start === end) return false;
  const { day, minutes } = localNow(schedule.tz, now);
  if (start < end) {
    return schedule.days.includes(day) && minutes >= start && minutes < end;
  }
  // 밤을 넘김: 오늘 시작 이후이거나, 어제 시작해서 아직 끝나기 전
  const yesterday = (day + 6) % 7;
  return (
    (schedule.days.includes(day) && minutes >= start) ||
    (schedule.days.includes(yesterday) && minutes < end)
  );
};
