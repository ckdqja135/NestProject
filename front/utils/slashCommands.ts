import dayjs from 'dayjs';

export interface SlashCommand {
  name: string;
  usage: string;
  description: string;
  channelOnly?: boolean;
  // 외부 앱이 등록한 명령이면 앱 이름
  app?: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: 'remind',
    usage: '/remind 30분 회의 준비',
    description: '정한 시각에 나에게 알림 (30분, 2시간, 내일 9시, 15:30 …)',
  },
  { name: 'poll', usage: '/poll 점심? | 국밥 | 짜장', description: '투표 올리기 (| 로 질문과 선택지 구분)' },
  { name: 'status', usage: '/status 🗓️ 회의 중', description: '상태 메시지 (내용 없이 쓰면 지우기)' },
  { name: 'away', usage: '/away', description: '자리 비움으로 표시' },
  { name: 'back', usage: '/back', description: '온라인으로 표시' },
  { name: 'topic', usage: '/topic 이번 주 배포', description: '채널 주제 바꾸기', channelOnly: true },
  { name: 'mute', usage: '/mute', description: '이 채널 알림 끄기', channelOnly: true },
  { name: 'unmute', usage: '/unmute', description: '이 채널 알림 켜기', channelOnly: true },
  { name: 'shrug', usage: '/shrug 글', description: '글 끝에 ¯\\_(ツ)_/¯ 붙여 보내기' },
  { name: 'help', usage: '/help', description: '명령어 목록' },
];

// '/명령 나머지' → { name, args }
export const parseCommand = (text: string) => {
  // 앱 명령은 숫자·_·- 도 쓴다 (/deploy-prod)
  const match = /^\/([a-zA-Z][a-zA-Z0-9_-]*)(?:\s+([\s\S]*))?$/.exec(text.trim());
  return match ? { name: match[1].toLowerCase(), args: (match[2] || '').trim() } : null;
};

// /remind 의 시각: '30분', '2시간', '1시간 30분', '내일 9시', '내일 오후 3시', '15:30', '오후 3시 30분'
// 앞에서 시각을 읽고 남은 글을 돌려준다
export const parseRemindTime = (text: string, now = dayjs()) => {
  let rest = text.trim();
  let match = /^(?:(\d+)\s*시간)?\s*(?:(\d+)\s*분)?\s*(?:후|뒤)?\s*/.exec(rest);
  if (match && (match[1] || match[2]) && match[0].trim()) {
    const date = now.add(Number(match[1] || 0), 'hour').add(Number(match[2] || 0), 'minute');
    return { date: date.toDate(), rest: rest.slice(match[0].length).trim() };
  }
  let day = now;
  match = /^(오늘|내일|모레)\s*/.exec(rest);
  if (match) {
    day = now.add({ 오늘: 0, 내일: 1, 모레: 2 }[match[1] as '오늘' | '내일' | '모레'], 'day');
    rest = rest.slice(match[0].length);
  }
  match =
    /^(\d{1,2}):(\d{2})\s*/.exec(rest) || /^(?:(오전|오후)\s*)?(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?\s*/.exec(rest);
  if (!match) {
    return null;
  }
  let hour: number;
  let minute: number;
  if (match[0].includes(':')) {
    hour = Number(match[1]);
    minute = Number(match[2]);
  } else {
    hour = Number(match[2]);
    minute = Number(match[3] || 0);
    if (match[1] === '오후' && hour < 12) {
      hour += 12;
    } else if (match[1] === '오전' && hour === 12) {
      hour = 0;
    }
  }
  if (hour > 23 || minute > 59) {
    return null;
  }
  let date = day.hour(hour).minute(minute).second(0).millisecond(0);
  // 날짜를 말하지 않았는데 이미 지난 시각이면 내일로
  if (day === now && !date.isAfter(now)) {
    date = date.add(1, 'day');
  }
  return { date: date.toDate(), rest: rest.slice(match[0].length).trim() };
};

// /poll 질문 | 선택1 | 선택2
export const parsePollArgs = (args: string) => {
  const parts = args
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length >= 3 ? { q: parts[0], o: parts.slice(1, 11) } : null;
};

// /status 🗓️ 회의 중 → 이모지와 문구 (이모지로 시작하지 않으면 💬)
export const parseStatusArgs = (args: string) => {
  const match = /^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*([\s\S]*)$/u.exec(args);
  return match ? { emoji: match[1], text: match[2].trim() } : { emoji: '💬', text: args.trim() };
};
