import dayjs from 'dayjs';
import { DatabaseSeed, DEFAULT_STATUS, toDatabaseTemplate } from './model';

// 데이터베이스 템플릿 (만들 때 내용에 담고, 처음 연 한 사람이 넣는다)
const day = (offset: number) => dayjs().add(offset, 'day').format('YYYY-MM-DD');

const tasks = (): DatabaseSeed => ({
  properties: [
    { id: 'name', name: '할 일', type: 'title' },
    { id: 'status', name: '상태', type: 'status', options: DEFAULT_STATUS },
    { id: 'owner', name: '담당자', type: 'person' },
    { id: 'due', name: '마감일', type: 'date' },
    {
      id: 'priority',
      name: '우선순위',
      type: 'select',
      options: [
        { id: 'high', name: '높음', color: 'red' },
        { id: 'mid', name: '보통', color: 'yellow' },
        { id: 'low', name: '낮음', color: 'gray' },
      ],
    },
    { id: 'tags', name: '태그', type: 'multiSelect', options: [] },
  ],
  views: [
    { id: 'v-board', name: '보드', type: 'board', groupBy: 'status' },
    { id: 'v-table', name: '전체 목록', type: 'table', sorts: [{ prop: 'due', dir: 'asc' }] },
    { id: 'v-mine', name: '내 할 일', type: 'table', filters: [{ prop: 'owner', op: 'me' }] },
    { id: 'v-calendar', name: '캘린더', type: 'calendar', dateProp: 'due' },
  ],
  rows: [
    { values: { name: '요구사항 정리', status: 'doing', due: day(2), priority: 'high' } },
    { values: { name: '디자인 검토', status: 'todo', due: day(5), priority: 'mid' } },
    { values: { name: '주간 회의 준비', status: 'done', due: day(-1), priority: 'low' } },
  ],
});

const roadmap = (): DatabaseSeed => ({
  properties: [
    { id: 'name', name: '프로젝트', type: 'title' },
    {
      id: 'stage',
      name: '단계',
      type: 'status',
      options: [
        { id: 'plan', name: '기획', color: 'gray' },
        { id: 'build', name: '진행', color: 'blue' },
        { id: 'review', name: '검토', color: 'purple' },
        { id: 'launch', name: '출시', color: 'green' },
      ],
    },
    { id: 'owner', name: '책임자', type: 'person' },
    { id: 'start', name: '시작일', type: 'date' },
    { id: 'end', name: '목표일', type: 'date' },
    {
      id: 'quarter',
      name: '분기',
      type: 'select',
      options: ['1분기', '2분기', '3분기', '4분기'].map((name, i) => ({
        id: `q${i + 1}`,
        name,
        color: ['blue', 'green', 'orange', 'purple'][i],
      })),
    },
  ],
  views: [
    { id: 'v-board', name: '단계별', type: 'board', groupBy: 'stage' },
    { id: 'v-quarter', name: '분기별', type: 'board', groupBy: 'quarter' },
    { id: 'v-table', name: '표', type: 'table' },
    { id: 'v-calendar', name: '목표일', type: 'calendar', dateProp: 'end' },
  ],
  rows: [
    { values: { name: '신규 기능 A', stage: 'build', quarter: 'q1', end: day(30) } },
    { values: { name: '앱 개편', stage: 'plan', quarter: 'q2', end: day(80) } },
  ],
});

const bugs = (): DatabaseSeed => ({
  properties: [
    { id: 'name', name: '버그', type: 'title' },
    {
      id: 'status',
      name: '상태',
      type: 'status',
      options: [
        { id: 'new', name: '새로 옴', color: 'red' },
        { id: 'fixing', name: '고치는 중', color: 'blue' },
        { id: 'fixed', name: '고침', color: 'green' },
        { id: 'wontfix', name: '안 고침', color: 'gray' },
      ],
    },
    {
      id: 'severity',
      name: '심각도',
      type: 'select',
      options: [
        { id: 'critical', name: '치명적', color: 'red' },
        { id: 'major', name: '큼', color: 'orange' },
        { id: 'minor', name: '작음', color: 'yellow' },
      ],
    },
    { id: 'owner', name: '담당자', type: 'person' },
    { id: 'reported', name: '알린 날', type: 'date' },
    { id: 'link', name: '관련 링크', type: 'url' },
  ],
  views: [
    { id: 'v-board', name: '상태별', type: 'board', groupBy: 'status' },
    { id: 'v-table', name: '표', type: 'table', sorts: [{ prop: 'severity', dir: 'asc' }] },
  ],
  rows: [{ values: { name: '로그인 후 화면이 하얗게 보임', status: 'new', severity: 'major', reported: day(0) } }],
});

const contentCalendar = (): DatabaseSeed => ({
  properties: [
    { id: 'name', name: '제목', type: 'title' },
    {
      id: 'channel',
      name: '채널',
      type: 'select',
      options: [
        { id: 'blog', name: '블로그', color: 'blue' },
        { id: 'sns', name: 'SNS', color: 'pink' },
        { id: 'mail', name: '뉴스레터', color: 'green' },
      ],
    },
    {
      id: 'status',
      name: '상태',
      type: 'status',
      options: [
        { id: 'idea', name: '아이디어', color: 'gray' },
        { id: 'writing', name: '작성 중', color: 'yellow' },
        { id: 'scheduled', name: '예약됨', color: 'blue' },
        { id: 'published', name: '발행', color: 'green' },
      ],
    },
    { id: 'owner', name: '담당자', type: 'person' },
    { id: 'date', name: '발행일', type: 'date' },
  ],
  views: [
    { id: 'v-calendar', name: '발행 캘린더', type: 'calendar', dateProp: 'date' },
    { id: 'v-board', name: '진행 상황', type: 'board', groupBy: 'status' },
    { id: 'v-gallery', name: '갤러리', type: 'gallery' },
  ],
  rows: [
    { values: { name: '서비스 소개 글', channel: 'blog', status: 'writing', date: day(3) } },
    { values: { name: '이벤트 안내', channel: 'sns', status: 'idea', date: day(7) } },
  ],
});

const meetings = (): DatabaseSeed => ({
  properties: [
    { id: 'name', name: '회의', type: 'title' },
    { id: 'date', name: '날짜', type: 'date' },
    { id: 'people', name: '참석자', type: 'person' },
    {
      id: 'kind',
      name: '종류',
      type: 'select',
      options: [
        { id: 'weekly', name: '주간', color: 'blue' },
        { id: 'oneonone', name: '1:1', color: 'purple' },
        { id: 'client', name: '고객', color: 'orange' },
      ],
    },
    { id: 'summary', name: '요약', type: 'text' },
  ],
  views: [
    { id: 'v-table', name: '최근 회의', type: 'table', sorts: [{ prop: 'date', dir: 'desc' }] },
    { id: 'v-calendar', name: '캘린더', type: 'calendar', dateProp: 'date' },
  ],
  rows: [{ values: { name: '주간 회의', date: day(0), kind: 'weekly' } }],
});

export const DATABASE_TEMPLATES = {
  tasks: () => toDatabaseTemplate(tasks()),
  roadmap: () => toDatabaseTemplate(roadmap()),
  bugs: () => toDatabaseTemplate(bugs()),
  content: () => toDatabaseTemplate(contentCalendar()),
  meetings: () => toDatabaseTemplate(meetings()),
};
