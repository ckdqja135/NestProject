import type { DesignSeed, DNode, NodeType } from './model';

// 디자인 템플릿: 문서 내용에 design:{...} 로 담아 만들고, 처음 연 사람이 캔버스에 넣는다.

// 프레임 도구를 고르면 오른쪽에 나오는 기기 크기
export const FRAME_PRESETS: { group: string; items: { name: string; w: number; h: number }[] }[] = [
  {
    group: '휴대폰',
    items: [
      { name: 'iPhone 16', w: 393, h: 852 },
      { name: 'iPhone 16 Pro Max', w: 440, h: 956 },
      { name: 'Android (보통)', w: 360, h: 800 },
      { name: 'Android (큰 화면)', w: 412, h: 917 },
    ],
  },
  {
    group: '태블릿',
    items: [
      { name: 'iPad mini', w: 744, h: 1133 },
      { name: 'iPad Pro 11"', w: 834, h: 1194 },
    ],
  },
  {
    group: '데스크톱',
    items: [
      { name: '데스크톱', w: 1440, h: 1024 },
      { name: 'MacBook Air', w: 1280, h: 832 },
      { name: 'FHD 화면', w: 1920, h: 1080 },
    ],
  },
  {
    group: '그 밖',
    items: [
      { name: '발표 (16:9)', w: 1920, h: 1080 },
      { name: 'A4', w: 595, h: 842 },
      { name: '정사각 게시물', w: 1080, h: 1080 },
      { name: '세로 스토리', w: 1080, h: 1920 },
    ],
  },
];

type Seed = DesignSeed['nodes'][number];

// 템플릿을 짧게 쓰기 위한 도우미
const builder = (page: string) => {
  const nodes: Seed[] = [];
  let n = 0;
  const add = (type: NodeType, parent: string | null, fields: Partial<DNode>) => {
    n += 1;
    const id = `t${n}`;
    nodes.push({ id, type, page, parent, ...fields });
    return id;
  };
  return {
    nodes,
    frame: (name: string, x: number, y: number, w: number, h: number, fields: Partial<DNode> = {}) =>
      add('frame', null, { name, x, y, w, h, ...fields }),
    rect: (parent: string, x: number, y: number, w: number, h: number, fields: Partial<DNode> = {}) =>
      add('rect', parent, { x, y, w, h, ...fields }),
    ellipse: (parent: string, x: number, y: number, w: number, h: number, fields: Partial<DNode> = {}) =>
      add('ellipse', parent, { x, y, w, h, ...fields }),
    line: (parent: string, x: number, y: number, dx: number, dy: number, fields: Partial<DNode> = {}) =>
      add('line', parent, { x, y, w: dx, h: dy, ...fields }),
    text: (parent: string, x: number, y: number, text: string, fields: Partial<DNode> = {}) =>
      add('text', parent, { x, y, text, ...fields }),
    // 가운데 정렬 글 (너비 고정)
    label: (parent: string, x: number, y: number, w: number, text: string, fields: Partial<DNode> = {}) =>
      add('text', parent, { x, y, w, text, align: 'center', textMode: 'fixed', ...fields }),
  };
};

const toContent = (seed: DesignSeed) => `design:${JSON.stringify(seed)}`;

const mobileApp = () => {
  const b = builder('p1');
  const PURPLE = '#6c5ce7';
  const home = b.frame('홈', 0, 0, 393, 852);
  b.text(home, 28, 16, '9:41', { fontSize: 15, fontWeight: 600 });
  b.text(home, 24, 64, '안녕하세요, 문서왕님', { fontSize: 26, fontWeight: 700, name: '인사' });
  b.text(home, 24, 104, '오늘 할 일을 확인해 보세요', { fontSize: 15, fill: '#6b6b70' });
  b.rect(home, 24, 148, 345, 160, { radius: 20, fill: PURPLE, shadow: true, name: '진행률 카드' });
  b.text(home, 48, 172, '이번 주 진행률', { fontSize: 14, fill: '#ffffff' });
  b.text(home, 48, 196, '72%', { fontSize: 40, fontWeight: 700, fill: '#ffffff' });
  b.rect(home, 48, 266, 297, 8, { radius: 4, fill: '#9d93f0', name: '진행 막대 배경' });
  b.rect(home, 48, 266, 214, 8, { radius: 4, fill: '#ffffff', name: '진행 막대' });
  b.text(home, 24, 340, '할 일', { fontSize: 18, fontWeight: 700 });
  ['디자인 시안 검토', '주간 회의 준비', '출시 공지 쓰기'].forEach((task, i) => {
    const y = 376 + i * 72;
    b.rect(home, 24, y, 345, 60, { radius: 14, fill: '#f4f4f7', name: `할 일 ${i + 1}` });
    b.ellipse(home, 42, y + 18, 24, 24, {
      fill: i === 0 ? PURPLE : '',
      stroke: i === 0 ? '' : '#c7c7cc',
      strokeWidth: 2,
    });
    b.text(home, 80, y + 19, task, { fontSize: 15, fill: i === 0 ? '#8e8e93' : '#1e1e1e' });
  });
  b.ellipse(home, 321, 692, 52, 52, { fill: PURPLE, shadow: true, name: '추가 버튼' });
  b.label(home, 321, 699, 52, '+', { fontSize: 28, fill: '#ffffff', fontWeight: 500 });
  b.rect(home, 0, 768, 393, 84, { fill: '#ffffff', name: '탭 막대' });
  b.line(home, 0, 768, 393, 0, { stroke: '#e5e5ea', strokeWidth: 1 });
  ['홈', '검색', '알림', '내 정보'].forEach((tab, i) =>
    b.label(home, i * 98, 790, 98, tab, {
      fontSize: 12,
      fontWeight: i === 0 ? 700 : 400,
      fill: i === 0 ? PURPLE : '#8e8e93',
    }),
  );

  const detail = b.frame('상세', 473, 0, 393, 852);
  b.text(detail, 24, 64, '‹ 뒤로', { fontSize: 16, fill: PURPLE });
  b.rect(detail, 24, 112, 345, 220, { radius: 20, fill: '#e9e9f0', name: '그림 자리' });
  b.label(detail, 24, 210, 345, '그림 자리', { fontSize: 14, fill: '#8e8e93' });
  b.text(detail, 24, 360, '디자인 시안 검토', { fontSize: 24, fontWeight: 700 });
  b.text(
    detail,
    24,
    404,
    '새 홈 화면 시안을 같이 보고 의견을 남겨 주세요. 캔버스의 댓글 도구(C)로 원하는 곳에 바로 남길 수 있어요.',
    { fontSize: 15, fill: '#4a4a4f', textMode: 'fixed', w: 345, lineHeight: 1.6 },
  );
  b.rect(detail, 24, 760, 345, 54, { radius: 14, fill: PURPLE, name: '버튼' });
  b.label(detail, 24, 776, 345, '시작하기', { fontSize: 16, fontWeight: 600, fill: '#ffffff' });
  return toContent({ pages: [{ id: 'p1', name: '화면' }], nodes: b.nodes });
};

const landing = () => {
  const b = builder('p1');
  const INDIGO = '#4f46e5';
  const f = b.frame('랜딩 페이지', 0, 0, 1440, 1024);
  b.text(f, 80, 34, 'Shlack', { fontSize: 22, fontWeight: 800 });
  ['기능', '가격', '고객 사례', '블로그'].forEach((menu, i) => b.text(f, 760 + i * 96, 40, menu, { fontSize: 15 }));
  b.rect(f, 1220, 28, 140, 44, { radius: 22, fill: '#1e1e1e', name: '시작 버튼' });
  b.label(f, 1220, 39, 140, '시작하기', { fontSize: 15, fontWeight: 600, fill: '#ffffff' });
  b.text(f, 80, 180, '팀이 함께 일하는\n가장 빠른 방법', {
    fontSize: 64,
    fontWeight: 800,
    lineHeight: 1.15,
    name: '헤드라인',
  });
  b.text(f, 80, 360, '메시지·문서·회의를 한곳에서. 지금 무료로 시작해 보세요.', {
    fontSize: 20,
    fill: '#55555c',
    textMode: 'fixed',
    w: 600,
  });
  b.rect(f, 80, 440, 220, 58, { radius: 29, fill: INDIGO, shadow: true, name: '주 버튼' });
  b.label(f, 80, 456, 220, '무료로 시작하기', { fontSize: 17, fontWeight: 600, fill: '#ffffff' });
  b.text(f, 330, 456, '데모 보기 →', { fontSize: 17, fontWeight: 600, fill: INDIGO });
  b.rect(f, 800, 150, 560, 420, { radius: 28, fill: '#eef0ff', name: '그림' });
  b.ellipse(f, 1010, 220, 180, 180, { fill: '#c7d2fe' });
  b.rect(f, 880, 450, 400, 84, { radius: 18, fill: '#ffffff', shadow: true });
  b.ellipse(f, 904, 472, 40, 40, { fill: INDIGO });
  b.text(f, 960, 474, '새 메시지 3개', { fontSize: 16, fontWeight: 600 });
  b.text(f, 960, 498, '디자인 채널 · 방금', { fontSize: 13, fill: '#8e8e93' });
  [
    ['실시간 메시지', '채널·스레드·DM 으로 빠르게 이야기해요.', '#fde68a'],
    ['함께 쓰는 문서', '문서·위키·데이터베이스를 여럿이 동시에 고쳐요.', '#bbf7d0'],
    ['허들과 통화', '문서를 보면서 바로 음성·화상으로 이야기해요.', '#bfdbfe'],
  ].forEach(([title, desc, color], i) => {
    const x = 80 + i * 440;
    b.rect(f, x, 660, 400, 260, { radius: 24, fill: '#f7f7f8', name: `기능 ${i + 1}` });
    b.ellipse(f, x + 32, 692, 52, 52, { fill: color });
    b.text(f, x + 32, 772, title, { fontSize: 22, fontWeight: 700 });
    b.text(f, x + 32, 812, desc, { fontSize: 16, fill: '#66666c', textMode: 'fixed', w: 336, lineHeight: 1.5 });
  });
  return toContent({ pages: [{ id: 'p1', name: '랜딩' }], nodes: b.nodes });
};

const dashboard = () => {
  const b = builder('p1');
  const GRAY = '#e4e4e7';
  const f = b.frame('대시보드', 0, 0, 1280, 800, { fill: '#fafafa' });
  b.rect(f, 0, 0, 220, 800, { fill: '#ffffff', name: '사이드바' });
  b.line(f, 220, 0, 0, 800, { stroke: GRAY, strokeWidth: 1 });
  b.rect(f, 24, 24, 120, 24, { radius: 6, fill: GRAY, name: '로고' });
  [0, 1, 2, 3, 4].forEach((i) =>
    b.rect(f, 24, 96 + i * 44, i === 0 ? 172 : 140, 28, { radius: 8, fill: i === 0 ? '#d4d4d8' : '#f4f4f5' }),
  );
  b.text(f, 252, 28, '개요', { fontSize: 24, fontWeight: 700 });
  b.rect(f, 1080, 24, 168, 40, { radius: 10, fill: '#18181b', name: '버튼' });
  b.label(f, 1080, 34, 168, '보고서 내보내기', { fontSize: 14, fontWeight: 600, fill: '#ffffff' });
  [
    ['방문자', '12,480'],
    ['가입', '1,204'],
    ['전환율', '9.6%'],
    ['매출', '₩38.2M'],
  ].forEach(([title, value], i) => {
    const x = 252 + i * 252;
    b.rect(f, x, 96, 232, 120, { radius: 14, fill: '#ffffff', stroke: GRAY, name: `지표 ${i + 1}` });
    b.text(f, x + 20, 116, title, { fontSize: 14, fill: '#71717a' });
    b.text(f, x + 20, 144, value, { fontSize: 30, fontWeight: 700 });
  });
  b.rect(f, 252, 240, 640, 320, { radius: 14, fill: '#ffffff', stroke: GRAY, name: '차트' });
  b.text(f, 272, 260, '주간 방문자', { fontSize: 16, fontWeight: 600 });
  [120, 180, 150, 220, 260, 200, 240].forEach((h, i) =>
    b.rect(f, 292 + i * 84, 530 - h, 48, h, { radius: 8, fill: i === 4 ? '#6366f1' : '#c7d2fe' }),
  );
  b.rect(f, 916, 240, 336, 320, { radius: 14, fill: '#ffffff', stroke: GRAY, name: '최근 활동' });
  b.text(f, 936, 260, '최근 활동', { fontSize: 16, fontWeight: 600 });
  [0, 1, 2, 3].forEach((i) => {
    b.ellipse(f, 936, 304 + i * 60, 36, 36, { fill: GRAY });
    b.rect(f, 984, 308 + i * 60, 180, 12, { radius: 6, fill: GRAY });
    b.rect(f, 984, 328 + i * 60, 120, 10, { radius: 5, fill: '#f4f4f5' });
  });
  b.rect(f, 252, 584, 1000, 192, { radius: 14, fill: '#ffffff', stroke: GRAY, name: '표' });
  [0, 1, 2, 3].forEach((i) => {
    if (i) b.line(f, 252, 584 + i * 48, 1000, 0, { stroke: '#f4f4f5', strokeWidth: 1 });
    [0, 1, 2, 3].forEach((c) =>
      b.rect(f, 276 + c * 240, 602 + i * 48, c === 0 ? 160 : 100, 12, {
        radius: 6,
        fill: i === 0 ? '#d4d4d8' : GRAY,
      }),
    );
  });
  return toContent({ pages: [{ id: 'p1', name: '와이어프레임' }], nodes: b.nodes });
};

export const DESIGN_TEMPLATES = {
  mobile: mobileApp,
  landing,
  dashboard,
};
