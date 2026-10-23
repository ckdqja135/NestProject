// 화이트보드 템플릿: Excalidraw 요소 뼈대(skeleton) 목록. 처음 연 사람이 보드에 넣는다.
// 문서 내용에는 board:{"v":1,"elements":[...]} 로 담아 만든다.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Skeleton = Record<string, any>;

export const BOARD_TEMPLATE_PREFIX = 'board:';

export const parseBoardTemplate = (content: string): Skeleton[] | null => {
  if (!content?.startsWith(BOARD_TEMPLATE_PREFIX)) return null;
  try {
    const value = JSON.parse(content.slice(BOARD_TEMPLATE_PREFIX.length));
    return Array.isArray(value?.elements) ? value.elements : null;
  } catch {
    return null;
  }
};

export const toBoardTemplate = (elements: Skeleton[]) =>
  `${BOARD_TEMPLATE_PREFIX}${JSON.stringify({ v: 1, elements })}`;

const STICKY = {
  yellow: '#fff3bf',
  pink: '#ffd8e8',
  green: '#d3f9d8',
  blue: '#d0ebff',
  purple: '#e5dbff',
  orange: '#ffe8cc',
};

const sticky = (id: string, x: number, y: number, text: string, color: string, size = 160): Skeleton => ({
  id,
  type: 'rectangle',
  x,
  y,
  width: size,
  height: size,
  backgroundColor: color,
  strokeColor: 'transparent',
  fillStyle: 'solid',
  roughness: 0,
  roundness: { type: 3 },
  // 테두리를 투명하게 해도 글자는 보이게 (글자 색은 따로 정하지 않으면 테두리 색을 따른다)
  ...(text ? { label: { text, fontSize: 18, fontFamily: 2, strokeColor: '#1e1e1e' } } : {}),
});

const title = (id: string, x: number, y: number, text: string, fontSize = 32): Skeleton => ({
  id,
  type: 'text',
  x,
  y,
  text,
  fontSize,
  fontFamily: 2,
});

const box = (
  id: string,
  type: 'rectangle' | 'ellipse' | 'diamond',
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  backgroundColor: string,
): Skeleton => ({
  id,
  type,
  x,
  y,
  width,
  height,
  backgroundColor,
  fillStyle: 'solid',
  strokeColor: '#1e1e1e',
  roughness: 0,
  roundness: type === 'rectangle' ? { type: 3 } : null,
  label: { text, fontSize: 18, fontFamily: 2, strokeColor: '#1e1e1e' },
});

// 두 도형을 잇는 화살표: 도형 가운데끼리 잇되, 테두리에서 시작하고 끝나게 계산한다
const link = (id: string, from: Skeleton, to: Skeleton, label?: string): Skeleton => {
  const center = (b: Skeleton) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
  const edge = (b: Skeleton, dx: number, dy: number) => {
    const c = center(b);
    const gap = 8;
    const t = Math.min(
      dx ? (b.width / 2 + gap) / Math.abs(dx) : Infinity,
      dy ? (b.height / 2 + gap) / Math.abs(dy) : Infinity,
    );
    return { x: c.x + dx * t, y: c.y + dy * t };
  };
  const a = center(from);
  const b = center(to);
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const start = edge(from, ux, uy);
  const end = edge(to, -ux, -uy);
  return {
    id,
    type: 'arrow',
    x: start.x,
    y: start.y,
    width: end.x - start.x,
    height: end.y - start.y,
    points: [
      [0, 0],
      [end.x - start.x, end.y - start.y],
    ],
    roughness: 0,
    strokeColor: '#495057',
    start: { id: from.id },
    end: { id: to.id },
    ...(label ? { label: { text: label, fontSize: 16, fontFamily: 2, strokeColor: '#1e1e1e' } } : {}),
  };
};

const column = (prefix: string, x: number, heading: string, color: string, notes: string[]): Skeleton[] => [
  {
    id: `${prefix}-bg`,
    type: 'rectangle',
    x,
    y: 0,
    width: 380,
    height: 720,
    backgroundColor: '#f8f9fa',
    strokeColor: '#dee2e6',
    fillStyle: 'solid',
    roughness: 0,
    roundness: { type: 3 },
  },
  title(`${prefix}-title`, x + 24, 20, heading, 28),
  ...notes.map((text, i) =>
    sticky(`${prefix}-n${i}`, x + 24 + (i % 2) * 176, 90 + Math.floor(i / 2) * 176, text, color),
  ),
];

export const BOARD_TEMPLATES: Record<string, () => string> = {
  retro: () =>
    toBoardTemplate([
      title('retro-heading', 0, -90, '회고 (Keep · Problem · Try)', 40),
      ...column('keep', 0, '😀 Keep (계속할 것)', STICKY.green, ['좋았던 점', '']),
      ...column('problem', 420, '😕 Problem (문제)', STICKY.pink, ['아쉬웠던 점', '']),
      ...column('try', 840, '💡 Try (해 볼 것)', STICKY.blue, ['다음에 해 볼 것', '']),
    ]),
  kanban: () =>
    toBoardTemplate([
      title('kanban-heading', 0, -90, '이번 주 할 일', 40),
      ...column('todo', 0, '할 일', STICKY.yellow, ['할 일 1', '할 일 2']),
      ...column('doing', 420, '진행 중', STICKY.orange, ['하는 중']),
      ...column('done', 840, '완료', STICKY.green, ['끝낸 일']),
    ]),
  brainstorm: () =>
    toBoardTemplate([
      box('bs-topic', 'ellipse', 300, 220, 260, 140, '주제', STICKY.purple),
      sticky('bs-1', 0, 0, '아이디어', STICKY.yellow),
      sticky('bs-2', 350, -40, '아이디어', STICKY.pink),
      sticky('bs-3', 700, 0, '아이디어', STICKY.blue),
      sticky('bs-4', 0, 420, '아이디어', STICKY.green),
      sticky('bs-5', 350, 460, '아이디어', STICKY.orange),
      sticky('bs-6', 700, 420, '아이디어', STICKY.yellow),
    ]),
  mindmap: () => {
    const center = box('mm-center', 'ellipse', 400, 300, 240, 120, '중심 주제', STICKY.purple);
    const branches = [
      box('mm-a', 'rectangle', 0, 80, 200, 80, '가지 1', STICKY.blue),
      box('mm-b', 'rectangle', 840, 80, 200, 80, '가지 2', STICKY.green),
      box('mm-c', 'rectangle', 0, 560, 200, 80, '가지 3', STICKY.orange),
      box('mm-d', 'rectangle', 840, 560, 200, 80, '가지 4', STICKY.pink),
    ];
    return toBoardTemplate([center, ...branches, ...branches.map((b) => link(`${b.id}-link`, center, b))]);
  },
  flowchart: () => {
    const start = box('fc-start', 'ellipse', 120, 0, 200, 80, '시작', STICKY.green);
    const step = box('fc-step', 'rectangle', 120, 160, 200, 90, '할 일', STICKY.blue);
    const check = box('fc-check', 'diamond', 100, 330, 240, 140, '조건?', STICKY.yellow);
    const yes = box('fc-yes', 'rectangle', 120, 550, 200, 90, '예일 때', STICKY.blue);
    const no = box('fc-no', 'rectangle', 460, 355, 200, 90, '아니오일 때', STICKY.orange);
    const end = box('fc-end', 'ellipse', 120, 720, 200, 80, '끝', STICKY.pink);
    return toBoardTemplate([
      start,
      step,
      check,
      yes,
      no,
      end,
      link('fc-1', start, step),
      link('fc-2', step, check),
      link('fc-3', check, yes, '예'),
      link('fc-4', check, no, '아니오'),
      link('fc-5', yes, end),
    ]);
  },
};
