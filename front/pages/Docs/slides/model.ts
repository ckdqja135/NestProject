import { splitSlides } from '@utils/docMarkdown';

// 슬라이드 한 쪽은 960×540 좌표 위에 놓인 글상자·도형·이미지
export const W = 960;
export const H = 540;

export type ShapeKind =
  | 'rect'
  | 'round'
  | 'ellipse'
  | 'triangle'
  | 'arrow'
  | 'line'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'star'
  | 'callout'
  | 'chevron'
  | 'plus'
  | 'parallelogram';

export type Anim = 'none' | 'fade' | 'up' | 'left' | 'zoom';
export type Transition = 'none' | 'fade' | 'slide' | 'zoom';
export type FontKey = 'sans' | 'serif' | 'mono' | 'round';
export const FONTS: Record<FontKey, { name: string; css: string }> = {
  sans: { name: '고딕', css: "-apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif" },
  serif: { name: '명조', css: "'AppleMyungjo', 'Nanum Myeongjo', 'Batang', serif" },
  round: { name: '둥근', css: "'Apple SD Gothic Neo', 'NanumSquareRound', 'Noto Sans KR', sans-serif" },
  mono: { name: '고정폭', css: 'Monaco, Menlo, Consolas, monospace' },
};

export interface TableData {
  rows: string[][];
  header?: boolean; // 첫 행을 머리글로
  headerBg?: string;
  border?: string;
}

export interface ChartSpec {
  type: 'column' | 'bar' | 'line' | 'area' | 'pie';
  // 탭으로 나눈 표: 첫 행 계열 이름, 첫 열 항목
  data: string;
  title?: string;
}

export interface SlideElement {
  id: string;
  type: 'text' | 'shape' | 'image' | 'table' | 'chart';
  x: number;
  y: number;
  w: number;
  h: number;
  // 글상자·도형 안 글 (마크다운: # 제목, - 목록, **굵게**)
  text?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  // 도형
  shape?: ShapeKind;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: 'solid' | 'dashed' | 'dotted';
  radius?: number; // 둥근 모서리 (도형·그림)
  // 이미지 (https 주소 또는 작게 줄인 data: 그림)
  src?: string;
  // 공통 모양
  rot?: number; // 회전 (도)
  opacity?: number; // 0~1
  shadow?: boolean;
  font?: FontKey;
  underline?: boolean;
  strike?: boolean;
  lineHeight?: number;
  anim?: Anim; // 발표할 때 나타나는 효과 (누를 때마다 차례로)
  table?: TableData;
  chart?: ChartSpec;
}

export interface Slide {
  id: string;
  background: string;
  elements: SlideElement[];
  notes?: string;
  transition?: Transition;
  hidden?: boolean; // 발표할 때 건너뛰기
}

export interface Theme {
  key: string;
  name: string;
  background: string;
  text: string;
  accent: string;
}

export const THEMES: Theme[] = [
  { key: 'light', name: '기본', background: '#ffffff', text: '#1d1c1d', accent: '#1264a3' },
  { key: 'dark', name: '어두움', background: '#1f2329', text: '#f2f3f5', accent: '#4ea1ff' },
  { key: 'navy', name: '남색', background: '#14274e', text: '#ffffff', accent: '#f6c445' },
  { key: 'mint', name: '민트', background: '#e8f6f1', text: '#14322a', accent: '#12a06b' },
  { key: 'warm', name: '따뜻함', background: '#fff6ec', text: '#3b2412', accent: '#e8891d' },
];

export interface Deck {
  v: 1;
  theme: string;
  slides: Slide[];
}

export const newId = () => Math.random().toString(36).slice(2, 10);

export const themeOf = (deck: Deck) => THEMES.find((t) => t.key === deck.theme) || THEMES[0];

export type Layout = 'title' | 'content' | 'two' | 'blank';

export const LAYOUTS: { key: Layout; name: string }[] = [
  { key: 'title', name: '제목' },
  { key: 'content', name: '제목 + 내용' },
  { key: 'two', name: '두 칸' },
  { key: 'blank', name: '빈 쪽' },
];

const text = (over: Partial<SlideElement>): SlideElement => ({
  id: newId(),
  type: 'text',
  x: 80,
  y: 60,
  w: 800,
  h: 80,
  text: '',
  fontSize: 28,
  align: 'left',
  valign: 'top',
  ...over,
});

export const makeSlide = (layout: Layout, theme: Theme, title = '', body = ''): Slide => {
  const base = { id: newId(), background: theme.background };
  switch (layout) {
    case 'title':
      return {
        ...base,
        elements: [
          text({
            y: 170,
            h: 110,
            text: title || '제목을 입력하세요',
            fontSize: 52,
            bold: true,
            align: 'center',
            valign: 'middle',
            color: theme.text,
          }),
          text({ y: 300, h: 60, text: body || '부제목', fontSize: 26, align: 'center', color: theme.accent }),
        ],
      };
    case 'content':
      return {
        ...base,
        elements: [
          text({ y: 50, h: 80, text: title || '제목', fontSize: 40, bold: true, color: theme.text, valign: 'middle' }),
          text({
            y: 150,
            h: 330,
            text: body || '- 첫 번째 내용\n- 두 번째 내용\n- 세 번째 내용',
            fontSize: 26,
            color: theme.text,
          }),
        ],
      };
    case 'two':
      return {
        ...base,
        elements: [
          text({ y: 50, h: 80, text: title || '제목', fontSize: 40, bold: true, color: theme.text, valign: 'middle' }),
          text({ y: 150, w: 380, h: 330, text: '- 왼쪽 내용', fontSize: 24, color: theme.text }),
          text({ x: 500, y: 150, w: 380, h: 330, text: '- 오른쪽 내용', fontSize: 24, color: theme.text }),
        ],
      };
    default:
      return { ...base, elements: [] };
  }
};

export const emptyDeck = (): Deck => ({ v: 1, theme: 'light', slides: [makeSlide('title', THEMES[0])] });

// 예전(마크다운 --- 로 나눈) 슬라이드는 쪽마다 글상자 하나로 바꾼다
const fromMarkdown = (content: string): Deck => {
  const theme = THEMES[0];
  const pages = splitSlides(content).filter((p) => p.trim());
  if (!pages.length) return emptyDeck();
  return {
    v: 1,
    theme: theme.key,
    slides: pages.map((page) => ({
      id: newId(),
      background: theme.background,
      elements: [text({ y: 50, h: 440, text: page.trim(), fontSize: 26, color: theme.text })],
    })),
  };
};

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export const parseDeck = (content: string): Deck => {
  if (!content.trim()) return emptyDeck();
  try {
    const data = JSON.parse(content);
    if (data && data.v === 1 && Array.isArray(data.slides)) {
      const slides: Slide[] = data.slides
        .filter((s: Slide) => s && Array.isArray(s.elements))
        .map((s: Slide) => ({
          id: typeof s.id === 'string' ? s.id : newId(),
          background: typeof s.background === 'string' ? s.background : '#ffffff',
          notes: typeof s.notes === 'string' ? s.notes : undefined,
          transition: typeof s.transition === 'string' ? s.transition : undefined,
          hidden: s.hidden === true ? true : undefined,
          elements: s.elements
            .filter((e) => e && ['text', 'shape', 'image', 'table', 'chart'].includes(e.type))
            .map((e) => ({
              ...e,
              id: typeof e.id === 'string' ? e.id : newId(),
              x: num(e.x, 0),
              y: num(e.y, 0),
              w: Math.max(4, num(e.w, 100)),
              h: Math.max(4, num(e.h, 100)),
            })),
        }));
      return {
        v: 1,
        theme: typeof data.theme === 'string' ? data.theme : 'light',
        slides: slides.length ? slides : emptyDeck().slides,
      };
    }
  } catch {
    // JSON 이 아니면 예전 마크다운 슬라이드
  }
  return fromMarkdown(content);
};

export const stringifyDeck = (deck: Deck) => JSON.stringify(deck);

// 안전한 그림 주소만 (https, 또는 슐랙이 줄여 넣은 data:image)
export const safeSrc = (src?: string) =>
  src && (/^https:\/\//i.test(src) || /^data:image\/(png|jpeg|gif|webp);base64,/i.test(src)) ? src : undefined;

// 올린 그림을 가로 1280px 이하 JPEG 로 줄여 data: 주소로 (문서에 글로 저장된다)
export const shrinkImage = (
  file: File,
  maxSide = 1280,
  quality = 0.8,
): Promise<{ src: string; w: number; h: number }> =>
  new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) {
      reject(new Error('PNG, JPG, GIF, WEBP 그림만 넣을 수 있습니다.'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('그림을 읽지 못했습니다.'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({ src: canvas.toDataURL('image/jpeg', quality), w: canvas.width, h: canvas.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('그림을 읽지 못했습니다.'));
    };
    img.src = url;
  });

// 회전한 상자의 네 꼭짓점을 감싸는 사각형 (스마트 가이드·여러 개 고르기에 쓴다)
export const bounds = (els: Pick<SlideElement, 'x' | 'y' | 'w' | 'h'>[]) => {
  const x1 = Math.min(...els.map((e) => e.x));
  const y1 = Math.min(...els.map((e) => e.y));
  const x2 = Math.max(...els.map((e) => e.x + e.w));
  const y2 = Math.max(...els.map((e) => e.y + e.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
};

export const newTable = (rows = 3, cols = 3): TableData => ({
  rows: Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => (r === 0 ? `제목 ${c + 1}` : '')),
  ),
  header: true,
  headerBg: '#1264a3',
  border: '#c7ccd1',
});

export const parseChartData = (text: string) => {
  const rows = text
    .trim()
    .split('\n')
    .map((line) => line.split('\t'));
  return rows.map((row, r) =>
    row.map((v, c) => {
      if (r === 0 || c === 0) return v.trim() || null;
      const n = Number(v.replace(/,/g, ''));
      return v.trim() !== '' && Number.isFinite(n) ? n : null;
    }),
  );
};
