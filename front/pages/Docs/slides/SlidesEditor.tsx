import { Global } from '@emotion/react';
import Modal from '@components/Modal';
import { Actions } from '@components/ModalForm/styles';
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowRight,
  BarChart3,
  Bold,
  BringToFront,
  ChevronDown,
  ChevronUp,
  Circle,
  ClipboardPaste,
  Copy,
  Diamond,
  Eye,
  EyeOff,
  Hexagon,
  ImagePlus,
  Italic,
  LayoutTemplate,
  MessageSquare,
  Minus,
  PaintBucket,
  Palette,
  Pentagon,
  Plus,
  Printer,
  Redo2,
  Scissors,
  SendToBack,
  Shapes,
  Square,
  Star,
  Strikethrough,
  Table as TableIcon,
  Trash2,
  Triangle,
  Type,
  Underline,
  Undo2,
} from 'lucide-react';
import React, { FC, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { toast } from 'react-toastify';
import {
  Anim,
  bounds,
  ChartSpec,
  Deck,
  FontKey,
  FONTS,
  H,
  Layout,
  LAYOUTS,
  makeSlide,
  newId,
  newTable,
  parseDeck,
  ShapeKind,
  shrinkImage,
  Slide,
  SlideElement,
  stringifyDeck,
  THEMES,
  themeOf,
  Transition,
  W,
} from './model';
import { Bar, Body, CtxMenu, Menu, ShapeGrid, SlidesWrap, Stage, SubBar, TableEditor, Thumbs } from './styles';
import SlideView, { Canvas, ElementBody, frameStyle, textStyle } from './SlideView';

interface Props {
  value: string;
  readOnly: boolean;
  workspace: string;
  title?: string;
  emojis?: Record<string, string>;
  current: number;
  onCurrentChange: (index: number) => void;
  onChange: (next: string) => void;
}

type Handle = 'move' | 'rotate' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  rot?: number;
}

const ICON = { size: 15, strokeWidth: 2 };
// 서버 본문 한도(약 1MB)보다 작게
export const MAX_DECK_SIZE = 900_000;
const SNAP = 6;
const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 60, 72, 96, 120];
const SHAPES: { kind: ShapeKind; name: string; icon: React.ReactNode }[] = [
  { kind: 'rect', name: '사각형', icon: <Square {...ICON} /> },
  { kind: 'round', name: '둥근 사각형', icon: <Square {...ICON} style={{ borderRadius: 4 }} /> },
  { kind: 'ellipse', name: '원', icon: <Circle {...ICON} /> },
  { kind: 'triangle', name: '삼각형', icon: <Triangle {...ICON} /> },
  { kind: 'diamond', name: '마름모', icon: <Diamond {...ICON} /> },
  { kind: 'pentagon', name: '오각형', icon: <Pentagon {...ICON} /> },
  { kind: 'hexagon', name: '육각형', icon: <Hexagon {...ICON} /> },
  { kind: 'star', name: '별', icon: <Star {...ICON} /> },
  { kind: 'callout', name: '말풍선', icon: <MessageSquare {...ICON} /> },
  { kind: 'arrow', name: '화살표', icon: <ArrowRight {...ICON} /> },
  { kind: 'chevron', name: '갈매기', icon: <ChevronDown {...ICON} style={{ transform: 'rotate(-90deg)' }} /> },
  { kind: 'plus', name: '더하기', icon: <Plus {...ICON} /> },
  { kind: 'parallelogram', name: '평행사변형', icon: <Square {...ICON} style={{ transform: 'skewX(-15deg)' }} /> },
  { kind: 'line', name: '선', icon: <Minus {...ICON} /> },
];
const HANDLES: [Handle, number, number][] = [
  ['nw', 0, 0],
  ['n', 0.5, 0],
  ['ne', 1, 0],
  ['e', 1, 0.5],
  ['se', 1, 1],
  ['s', 0.5, 1],
  ['sw', 0, 1],
  ['w', 0, 0.5],
];
const CURSORS: Record<Handle, string> = {
  move: 'move',
  rotate: 'grab',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};
const ANIMS: [Anim, string][] = [
  ['none', '없음'],
  ['fade', '나타나기'],
  ['up', '위로 올라오기'],
  ['left', '왼쪽에서 들어오기'],
  ['zoom', '확대'],
];
const TRANSITIONS: [Transition, string][] = [
  ['none', '없음'],
  ['fade', '밝아지기'],
  ['slide', '밀어내기'],
  ['zoom', '확대'],
];
const SAMPLE_CHART: ChartSpec = {
  type: 'column',
  data: '항목\t1분기\t2분기\nA\t30\t45\nB\t50\t40\nC\t20\t35',
  title: '차트 제목',
};

// 차트 데이터 고치기 (탭으로 나눈 표)
const ChartDataDialog: FC<{ spec: ChartSpec; onClose: () => void; onSave: (s: ChartSpec) => void }> = ({
  spec,
  onClose,
  onSave,
}) => {
  // 열 때마다 새로 만들어 처음 값으로 시작한다 (key 로)
  const [type, setType] = useState<ChartSpec['type']>(spec.type);
  const [title, setTitle] = useState(spec.title || '');
  const [data, setData] = useState(spec.data);
  return (
    <Modal
      show
      onCloseModal={onClose}
      title="차트 데이터"
      description="첫 행은 계열 이름, 첫 열은 항목입니다. 칸은 탭으로 나눕니다 (스프레드시트에서 복사해 붙여 넣어도 돼요)."
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ChartSpec['type'])}
          aria-label="차트 종류"
          style={{ height: 32 }}
        >
          <option value="column">세로 막대</option>
          <option value="bar">가로 막대</option>
          <option value="line">꺾은선</option>
          <option value="area">영역</option>
          <option value="pie">원형</option>
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
          aria-label="차트 제목"
          style={{
            flex: 1,
            height: 32,
            padding: '0 8px',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            background: 'var(--bg)',
            color: 'var(--text)',
          }}
        />
      </div>
      <textarea
        value={data}
        onChange={(e) => setData(e.target.value)}
        onKeyDown={(e) => {
          // 탭 키로 칸 나누기
          if (e.key === 'Tab') {
            e.preventDefault();
            const el = e.currentTarget;
            const at = el.selectionStart;
            setData(data.slice(0, at) + '\t' + data.slice(el.selectionEnd));
            requestAnimationFrame(() => el.setSelectionRange(at + 1, at + 1));
          }
        }}
        aria-label="차트 데이터"
        style={{
          width: '100%',
          height: 160,
          boxSizing: 'border-box',
          padding: 8,
          border: '1px solid var(--border-strong)',
          borderRadius: 6,
          background: 'var(--bg)',
          color: 'var(--text)',
          fontFamily: 'Monaco, Menlo, Consolas, monospace',
          fontSize: 13,
          tabSize: 12,
        }}
      />
      <Actions>
        <button type="button" onClick={onClose}>
          취소
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => onSave({ type, title: title.trim() || undefined, data: data.replace(/\r/g, '') })}
        >
          저장
        </button>
      </Actions>
    </Modal>
  );
};

// 파워포인트처럼: 쪽 목록, 캔버스에서 여러 요소를 끌어 놓고 크기·회전, 표·차트, 정렬, 발표 효과
const SlidesEditor: FC<Props> = ({ value, readOnly, workspace, title, emojis, current, onCurrentChange, onChange }) => {
  const deck = useMemo(() => parseDeck(value), [value]);
  const theme = themeOf(deck);
  const index = Math.max(0, Math.min(current, deck.slides.length - 1));
  const slide = deck.slides[index];
  const [selected, setSelected] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [draftTable, setDraftTable] = useState<string[][] | null>(null);
  const [drag, setDrag] = useState<{ rects: Record<string, Rect>; guides: { v: number[]; h: number[] } } | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [menu, setMenu] = useState<'layout' | 'shape' | 'image' | 'align' | null>(null);
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [fitScale, setFitScale] = useState(0.8);
  const [zoom, setZoom] = useState<'fit' | number>('fit');
  const [chartEdit, setChartEdit] = useState<string | null>(null);
  const [dragThumb, setDragThumb] = useState<number | null>(null);
  const [printing, setPrinting] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const clipboard = useRef<SlideElement[]>([]);
  const scale = zoom === 'fit' ? fitScale : zoom;

  const selectedEls = slide ? slide.elements.filter((e) => selected.includes(e.id)) : [];
  const primary = selectedEls[selectedEls.length - 1] || null;

  // 캔버스 크기: 가운데 칸 너비에 맞춘다
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const update = () => setFitScale(Math.max(0.25, Math.min(1.2, (stage.clientWidth - 40) / W)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menu && !ctx) return undefined;
    const close = () => {
      setMenu(null);
      setCtx(null);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menu, ctx]);

  // 쪽을 바꾸면 고르기를 푼다
  useEffect(() => {
    setSelected([]);
    setEditingId(null);
  }, [index]);

  // ── 바꾸기 (되돌리기 기록과 함께)
  const commit = useCallback(
    (next: Deck) => {
      if (readOnly) return false;
      const text = stringifyDeck(next);
      if (text === valueRef.current) return true;
      if (text.length > MAX_DECK_SIZE) {
        toast.error('슬라이드 용량이 너무 큽니다. 그림을 줄이거나 https 그림 주소로 넣어 주세요.', {
          position: 'bottom-center',
        });
        return false;
      }
      undoStack.current.push(valueRef.current);
      if (undoStack.current.length > 100) undoStack.current.shift();
      redoStack.current = [];
      onChange(text);
      return true;
    },
    [onChange, readOnly],
  );
  const updateSlide = (fn: (s: Slide) => Slide) =>
    commit({ ...deck, slides: deck.slides.map((s, i) => (i === index ? fn(s) : s)) });
  const updateEls = (ids: string[], patch: Partial<SlideElement> | ((e: SlideElement) => Partial<SlideElement>)) =>
    updateSlide((s) => ({
      ...s,
      elements: s.elements.map((e) =>
        ids.includes(e.id) ? { ...e, ...(typeof patch === 'function' ? patch(e) : patch) } : e,
      ),
    }));
  const updateSelected = (patch: Partial<SlideElement> | ((e: SlideElement) => Partial<SlideElement>)) =>
    updateEls(selected, patch);
  const addElements = (els: SlideElement[]) => {
    // 같은 자리에 이미 있으면 조금씩 비켜 놓는다 (연달아 넣어도 겹치지 않게)
    const taken = new Set(slide.elements.map((e) => `${Math.round(e.x)},${Math.round(e.y)}`));
    const placed = els.map((e) => {
      let { x, y } = e;
      for (let i = 0; i < 20 && taken.has(`${Math.round(x)},${Math.round(y)}`); i += 1) {
        x += 20;
        y += 20;
      }
      taken.add(`${Math.round(x)},${Math.round(y)}`);
      return { ...e, x, y };
    });
    if (updateSlide((s) => ({ ...s, elements: [...s.elements, ...placed] }))) setSelected(placed.map((e) => e.id));
  };
  const removeSelected = () => {
    if (!selected.length) return;
    updateSlide((s) => ({ ...s, elements: s.elements.filter((e) => !selected.includes(e.id)) }));
    setSelected([]);
  };

  const undo = () => {
    const prev = undoStack.current.pop();
    if (prev === undefined) return;
    redoStack.current.push(valueRef.current);
    onChange(prev);
  };
  const redo = () => {
    const next = redoStack.current.pop();
    if (next === undefined) return;
    undoStack.current.push(valueRef.current);
    onChange(next);
  };

  // ── 쪽
  const addSlide = (layout: Layout) => {
    const next = makeSlide(layout, theme);
    const slides = [...deck.slides];
    slides.splice(index + 1, 0, next);
    if (commit({ ...deck, slides })) onCurrentChange(index + 1);
  };
  const duplicateSlide = (i: number) => {
    const src = deck.slides[i];
    const copy: Slide = { ...src, id: newId(), elements: src.elements.map((e) => ({ ...e, id: newId() })) };
    const slides = [...deck.slides];
    slides.splice(i + 1, 0, copy);
    if (commit({ ...deck, slides })) onCurrentChange(i + 1);
  };
  const removeSlide = (i: number) => {
    if (deck.slides.length <= 1) return;
    if (commit({ ...deck, slides: deck.slides.filter((_, j) => j !== i) })) {
      onCurrentChange(Math.max(0, Math.min(i, deck.slides.length - 2)));
    }
  };
  const moveSlideTo = (from: number, to: number) => {
    if (from === to || to < 0 || to >= deck.slides.length) return;
    const slides = [...deck.slides];
    const [item] = slides.splice(from, 1);
    slides.splice(to, 0, item);
    if (commit({ ...deck, slides })) onCurrentChange(to);
  };
  const changeTheme = (key: string) => {
    const next = THEMES.find((t) => t.key === key);
    if (!next) return;
    // 테마 기본 배경·글자색을 쓰던 것만 새 테마 색으로
    commit({
      ...deck,
      theme: key,
      slides: deck.slides.map((s) => ({
        ...s,
        background: s.background === theme.background ? next.background : s.background,
        elements: s.elements.map((e) => ({
          ...e,
          color: e.color === theme.text ? next.text : e.color === theme.accent ? next.accent : e.color,
          fill: e.fill === theme.accent ? next.accent : e.fill,
        })),
      })),
    });
  };

  // ── 요소 넣기
  const addText = () =>
    addElements([
      {
        id: newId(),
        type: 'text',
        x: W / 2 - 200,
        y: H / 2 - 40,
        w: 400,
        h: 80,
        text: '글을 입력하세요',
        fontSize: 28,
        color: theme.text,
      },
    ]);
  const addShape = (kind: ShapeKind) =>
    addElements([
      {
        id: newId(),
        type: 'shape',
        shape: kind,
        x: W / 2 - 120,
        y: H / 2 - (kind === 'line' ? 10 : 80),
        w: 240,
        h: kind === 'line' ? 20 : kind === 'arrow' ? 100 : 160,
        fill: kind === 'line' ? undefined : theme.accent,
        stroke: kind === 'line' ? theme.text : undefined,
        strokeWidth: kind === 'line' ? 3 : undefined,
        color: '#ffffff',
        fontSize: 24,
      },
    ]);
  const addImage = (src: string, w: number, h: number) => {
    const fit = Math.min(1, 480 / w, 360 / h);
    const iw = Math.round(w * fit);
    const ih = Math.round(h * fit);
    addElements([{ id: newId(), type: 'image', src, x: (W - iw) / 2, y: (H - ih) / 2, w: iw, h: ih }]);
  };
  const addTable = () =>
    addElements([
      {
        id: newId(),
        type: 'table',
        x: 130,
        y: 140,
        w: 700,
        h: 240,
        table: newTable(4, 3),
        fontSize: 18,
        color: theme.text,
      },
    ]);
  const addChart = () =>
    addElements([
      { id: newId(), type: 'chart', x: 200, y: 110, w: 560, h: 340, chart: SAMPLE_CHART, color: theme.text },
    ]);
  const onImageFile = (file?: File) => {
    if (!file) return;
    shrinkImage(file, 1024, 0.75)
      .then(({ src, w, h }) => addImage(src, w, h))
      .catch((err) => toast.error(err.message, { position: 'bottom-center' }));
  };
  const onImageUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const url = imageUrl.trim();
    if (!/^https:\/\//i.test(url)) {
      toast.error('https:// 로 시작하는 그림 주소를 넣어 주세요.', { position: 'bottom-center' });
      return;
    }
    const img = new Image();
    img.onload = () => addImage(url, img.naturalWidth || 480, img.naturalHeight || 270);
    img.onerror = () => addImage(url, 480, 270);
    img.src = url;
    setImageUrl('');
    setMenu(null);
  };

  // ── 끌기·크기 조절·회전 (놓을 때 한 번만 저장)
  const toCanvas = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: (clientX - (rect?.left || 0)) / scale, y: (clientY - (rect?.top || 0)) / scale };
  };
  const startDrag = (el: SlideElement, handle: Handle) => (e: React.PointerEvent) => {
    if (readOnly || e.button !== 0 || editingId === el.id) return;
    e.preventDefault();
    e.stopPropagation();
    setCtx(null);
    let ids = selected;
    if (handle === 'move') {
      if (e.shiftKey || e.metaKey) {
        // Shift: 고르기에 더하거나 빼기
        ids = selected.includes(el.id) ? selected.filter((id) => id !== el.id) : [...selected, el.id];
        setSelected(ids);
        return;
      }
      if (!selected.includes(el.id)) {
        ids = [el.id];
        setSelected(ids);
      }
    }
    canvasRef.current?.focus();
    const sx = e.clientX;
    const sy = e.clientY;
    const starts: Record<string, Rect> = {};
    slide.elements
      .filter((x) => (handle === 'move' ? ids.includes(x.id) : x.id === el.id))
      .forEach((x) => {
        starts[x.id] = { x: x.x, y: x.y, w: x.w, h: x.h, rot: x.rot };
      });
    const others = slide.elements.filter((x) => !starts[x.id]);
    const vLines = [0, W / 2, W, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])];
    const hLines = [0, H / 2, H, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])];
    const group = bounds(Object.values(starts));
    const start = starts[el.id];
    const keepRatio = el.type === 'image' || e.shiftKey;
    let rects = starts;
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / scale;
      const dy = (ev.clientY - sy) / scale;
      if (!moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
      moved = true;
      const guides = { v: [] as number[], h: [] as number[] };
      if (handle === 'move') {
        let ox = dx;
        let oy = dy;
        if (!ev.altKey) {
          // 스마트 가이드: 다른 요소·쪽의 가장자리·가운데에 붙인다
          const xs = [group.x + dx, group.x + dx + group.w / 2, group.x + dx + group.w];
          const ys = [group.y + dy, group.y + dy + group.h / 2, group.y + dy + group.h];
          let best = SNAP + 1;
          xs.forEach((x) =>
            vLines.forEach((line) => {
              if (Math.abs(line - x) < best) {
                best = Math.abs(line - x);
                ox = dx + line - x;
                guides.v = [line];
              }
            }),
          );
          best = SNAP + 1;
          ys.forEach((y) =>
            hLines.forEach((line) => {
              if (Math.abs(line - y) < best) {
                best = Math.abs(line - y);
                oy = dy + line - y;
                guides.h = [line];
              }
            }),
          );
        }
        rects = Object.fromEntries(Object.entries(starts).map(([id, r]) => [id, { ...r, x: r.x + ox, y: r.y + oy }]));
      } else if (handle === 'rotate') {
        const cx = start.x + start.w / 2;
        const cy = start.y + start.h / 2;
        const p = toCanvas(ev.clientX, ev.clientY);
        let deg = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
        if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
        deg = ((Math.round(deg) % 360) + 360) % 360;
        rects = { [el.id]: { ...start, rot: deg } };
      } else {
        let { x, y, w, h } = start;
        if (handle.includes('e')) w = start.w + dx;
        if (handle.includes('s')) h = start.h + dy;
        if (handle.includes('w')) {
          w = start.w - dx;
          x = start.x + dx;
        }
        if (handle.includes('n')) {
          h = start.h - dy;
          y = start.y + dy;
        }
        if ((keepRatio || ev.shiftKey) && handle.length === 2) {
          const ratio = start.w / start.h;
          if (w / h > ratio) w = h * ratio;
          else h = w / ratio;
          if (handle.includes('w')) x = start.x + start.w - w;
          if (handle.includes('n')) y = start.y + start.h - h;
        }
        const min = 12;
        if (w < min) {
          if (handle.includes('w')) x -= min - w;
          w = min;
        }
        if (h < min) {
          if (handle.includes('n')) y -= min - h;
          h = min;
        }
        rects = { [el.id]: { ...start, x, y, w, h } };
      }
      setDrag({ rects, guides });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDrag(null);
      if (moved) {
        updateSlide((s) => ({
          ...s,
          elements: s.elements.map((x) => {
            const r = rects[x.id];
            return r
              ? {
                  ...x,
                  x: Math.round(r.x),
                  y: Math.round(r.y),
                  w: Math.round(r.w),
                  h: Math.round(r.h),
                  rot: r.rot || undefined,
                }
              : x;
          }),
        }));
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // 빈 곳을 끌면 상자로 여러 개 고르기
  const startMarquee = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target !== e.currentTarget && !target.dataset.bg) return;
    if (editingId) finishEdit();
    setCtx(null);
    const start = toCanvas(e.clientX, e.clientY);
    const additive = e.shiftKey;
    const base = additive ? selected : [];
    if (!additive) setSelected([]);
    canvasRef.current?.focus();
    let box: Rect = { x: start.x, y: start.y, w: 0, h: 0 };
    const onMove = (ev: PointerEvent) => {
      const p = toCanvas(ev.clientX, ev.clientY);
      box = {
        x: Math.min(start.x, p.x),
        y: Math.min(start.y, p.y),
        w: Math.abs(p.x - start.x),
        h: Math.abs(p.y - start.y),
      };
      setMarquee(box);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setMarquee(null);
      if (box.w < 3 && box.h < 3) return;
      const hit = slide.elements
        .filter((x) => x.x < box.x + box.w && x.x + x.w > box.x && x.y < box.y + box.h && x.y + x.h > box.y)
        .map((x) => x.id);
      setSelected(Array.from(new Set([...base, ...hit])));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // ── 글·표 고치기
  const startEdit = (el: SlideElement) => {
    if (readOnly) return;
    if (el.type === 'chart') {
      setSelected([el.id]);
      setChartEdit(el.id);
      return;
    }
    if (el.type === 'image' || el.shape === 'line') return;
    setSelected([el.id]);
    setEditingId(el.id);
    if (el.type === 'table') setDraftTable(el.table?.rows.map((r) => [...r]) || null);
    else setDraftText(el.text || '');
  };
  const finishEdit = () => {
    if (editingId) {
      const el = slide.elements.find((x) => x.id === editingId);
      if (el?.type === 'table' && draftTable && el.table) {
        if (JSON.stringify(el.table.rows) !== JSON.stringify(draftTable))
          updateEls([el.id], { table: { ...el.table, rows: draftTable } });
      } else if (el && (el.text || '') !== draftText) {
        updateEls([el.id], { text: draftText });
      }
    }
    setEditingId(null);
    setDraftTable(null);
    canvasRef.current?.focus();
  };

  // ── 복사·붙여넣기
  const copy = (cut: boolean) => {
    if (!selectedEls.length) return;
    clipboard.current = selectedEls.map((x) => ({ ...x }));
    if (cut) removeSelected();
  };
  const paste = () => {
    if (!clipboard.current.length) return;
    const els = clipboard.current.map((x) => ({ ...x, id: newId(), x: x.x + 20, y: x.y + 20 }));
    clipboard.current = els;
    addElements(els);
  };
  const duplicate = () => addElements(selectedEls.map((x) => ({ ...x, id: newId(), x: x.x + 20, y: x.y + 20 })));

  // ── 순서·정렬
  const zOrder = (kind: 'front' | 'back' | 'forward' | 'backward') => {
    if (!selected.length) return;
    updateSlide((s) => {
      const els = [...s.elements];
      if (kind === 'front' || kind === 'back') {
        const picked = els.filter((x) => selected.includes(x.id));
        const rest = els.filter((x) => !selected.includes(x.id));
        return { ...s, elements: kind === 'front' ? [...rest, ...picked] : [...picked, ...rest] };
      }
      const step = kind === 'forward' ? 1 : -1;
      const keys = Array.from(els.keys());
      const order = kind === 'forward' ? keys.reverse() : keys;
      order.forEach((i) => {
        const j = i + step;
        if (selected.includes(els[i].id) && j >= 0 && j < els.length && !selected.includes(els[j].id)) {
          [els[i], els[j]] = [els[j], els[i]];
        }
      });
      return { ...s, elements: els };
    });
  };
  const align = (kind: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'hdist' | 'vdist') => {
    if (!selectedEls.length) return;
    // 하나만 고르면 쪽 기준, 여럿이면 고른 것들의 둘레 기준
    const box = selectedEls.length === 1 ? { x: 0, y: 0, w: W, h: H } : bounds(selectedEls);
    if (kind === 'hdist' || kind === 'vdist') {
      if (selectedEls.length < 3) return;
      const horiz = kind === 'hdist';
      const sorted = [...selectedEls].sort((a, b) => (horiz ? a.x - b.x : a.y - b.y));
      const total = sorted.reduce((s, x) => s + (horiz ? x.w : x.h), 0);
      const gap = ((horiz ? box.w : box.h) - total) / (sorted.length - 1);
      let at = horiz ? box.x : box.y;
      const pos: Record<string, number> = {};
      sorted.forEach((x) => {
        pos[x.id] = at;
        at += (horiz ? x.w : x.h) + gap;
      });
      updateSelected((x) => (horiz ? { x: Math.round(pos[x.id]) } : { y: Math.round(pos[x.id]) }));
      return;
    }
    updateSelected((x) => {
      switch (kind) {
        case 'left':
          return { x: box.x };
        case 'center':
          return { x: Math.round(box.x + box.w / 2 - x.w / 2) };
        case 'right':
          return { x: box.x + box.w - x.w };
        case 'top':
          return { y: box.y };
        case 'middle':
          return { y: Math.round(box.y + box.h / 2 - x.h / 2) };
        default:
          return { y: box.y + box.h - x.h };
      }
    });
  };

  // ── 표
  const tableOp = (op: 'addRow' | 'delRow' | 'addCol' | 'delCol' | 'header') => {
    if (!primary?.table) return;
    const t = primary.table;
    let rows = t.rows.map((r) => [...r]);
    const cols = rows[0]?.length || 1;
    if (op === 'addRow') rows.push(Array(cols).fill(''));
    if (op === 'delRow' && rows.length > 1) rows = rows.slice(0, -1);
    if (op === 'addCol' && cols < 12) rows = rows.map((r) => [...r, '']);
    if (op === 'delCol' && cols > 1) rows = rows.map((r) => r.slice(0, -1));
    updateEls([primary.id], { table: { ...t, rows, header: op === 'header' ? !t.header : t.header } });
  };

  // ── 키보드
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editingId || readOnly) return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    if (mod && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if (mod && key === 'y') {
      e.preventDefault();
      redo();
      return;
    }
    if (mod && key === 'a') {
      e.preventDefault();
      setSelected(slide.elements.map((x) => x.id));
      return;
    }
    if (mod && key === 'v') {
      e.preventDefault();
      paste();
      return;
    }
    if (!selectedEls.length) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      removeSelected();
    } else if (e.key === 'Escape') {
      setSelected([]);
    } else if (e.key === 'Enter' && primary) {
      e.preventDefault();
      startEdit(primary);
    } else if (mod && key === 'c') {
      e.preventDefault();
      copy(false);
    } else if (mod && key === 'x') {
      e.preventDefault();
      copy(true);
    } else if (mod && key === 'd') {
      e.preventDefault();
      duplicate();
    } else if (mod && (e.key === ']' || e.key === '[')) {
      e.preventDefault();
      zOrder(e.key === ']' ? (e.shiftKey ? 'front' : 'forward') : e.shiftKey ? 'back' : 'backward');
    } else if (mod && (key === 'b' || key === 'i' || key === 'u')) {
      e.preventDefault();
      const prop = key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'underline';
      const on = !primary?.[prop];
      updateSelected({ [prop]: on || undefined });
    } else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const d = (
        { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] } as Record<
          string,
          number[]
        >
      )[e.key] || [0, 0];
      updateSelected((x) => ({ x: x.x + d[0], y: x.y + d[1] }));
    }
  };

  // ── PDF (인쇄)
  const printDeck = () => {
    setPrinting(true);
    window.setTimeout(() => {
      // PDF 파일 이름은 문서 제목으로
      const before = document.title;
      document.title = title || '슬라이드';
      window.print();
      document.title = before;
      setPrinting(false);
    }, 300);
  };

  const thumbScale = 150 / W;
  const isTextLike =
    !!primary &&
    (primary.type === 'text' || primary.type === 'shape' || primary.type === 'table') &&
    primary.shape !== 'line';
  const tb = (label: string, icon: React.ReactNode, onClick: () => void, on?: boolean, disabled?: boolean) => (
    <button
      type="button"
      onClick={onClick}
      className={on ? 'on' : undefined}
      title={label}
      aria-label={label}
      disabled={disabled}
    >
      {icon}
    </button>
  );
  const menuItem = (label: React.ReactNode, onClick: () => void, keyHint?: string) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setMenu(null);
        setCtx(null);
        onClick();
        canvasRef.current?.focus({ preventScroll: true });
      }}
    >
      {label}
      {keyHint && <span className="key">{keyHint}</span>}
    </button>
  );
  const alignItems = (
    <>
      {menuItem(
        <>
          <AlignStartVertical {...ICON} /> 왼쪽 맞춤
        </>,
        () => align('left'),
      )}
      {menuItem(
        <>
          <AlignCenterVertical {...ICON} /> 가로 가운데
        </>,
        () => align('center'),
      )}
      {menuItem(
        <>
          <AlignEndVertical {...ICON} /> 오른쪽 맞춤
        </>,
        () => align('right'),
      )}
      {menuItem(
        <>
          <AlignStartHorizontal {...ICON} /> 위쪽 맞춤
        </>,
        () => align('top'),
      )}
      {menuItem(
        <>
          <AlignCenterHorizontal {...ICON} /> 세로 가운데
        </>,
        () => align('middle'),
      )}
      {menuItem(
        <>
          <AlignEndHorizontal {...ICON} /> 아래쪽 맞춤
        </>,
        () => align('bottom'),
      )}
      {selectedEls.length >= 3 && (
        <>
          {menuItem(
            <>
              <AlignHorizontalDistributeCenter {...ICON} /> 가로 간격 같게
            </>,
            () => align('hdist'),
          )}
          {menuItem(
            <>
              <AlignVerticalDistributeCenter {...ICON} /> 세로 간격 같게
            </>,
            () => align('vdist'),
          )}
        </>
      )}
    </>
  );

  const chartEl = chartEdit ? slide.elements.find((x) => x.id === chartEdit) : null;

  return (
    // 단축키는 편집기 어디에 포커스가 있어도 (도구 단추·메뉴를 누른 뒤에도) 받는다
    <SlidesWrap ref={wrapRef} onKeyDown={onKeyDown}>
      {!readOnly && (
        <Bar role="toolbar" aria-label="슬라이드 도구" onClick={(e) => e.stopPropagation()}>
          {tb('되돌리기 (⌘Z)', <Undo2 {...ICON} />, undo, false, !undoStack.current.length)}
          {tb('다시 하기 (⇧⌘Z)', <Redo2 {...ICON} />, redo, false, !redoStack.current.length)}
          <span className="sep" />
          <span className="group">
            <button type="button" onClick={() => setMenu(menu === 'layout' ? null : 'layout')} aria-haspopup="menu">
              <LayoutTemplate {...ICON} /> 새 쪽 <ChevronDown size={12} />
            </button>
            {menu === 'layout' && (
              <Menu role="menu">
                {LAYOUTS.map((l) => (
                  <React.Fragment key={l.key}>{menuItem(l.name, () => addSlide(l.key))}</React.Fragment>
                ))}
              </Menu>
            )}
          </span>
          <button type="button" onClick={addText} title="글상자" aria-label="글상자">
            <Type {...ICON} /> 글상자
          </button>
          <span className="group">
            <button type="button" onClick={() => setMenu(menu === 'shape' ? null : 'shape')} aria-haspopup="menu">
              <Shapes {...ICON} /> 도형 <ChevronDown size={12} />
            </button>
            {menu === 'shape' && (
              <Menu role="menu" style={{ minWidth: 0 }}>
                <ShapeGrid>
                  {SHAPES.map((s) => (
                    <button
                      key={s.kind}
                      type="button"
                      role="menuitem"
                      title={s.name}
                      aria-label={s.name}
                      onClick={() => {
                        addShape(s.kind);
                        setMenu(null);
                      }}
                    >
                      {s.icon}
                    </button>
                  ))}
                </ShapeGrid>
              </Menu>
            )}
          </span>
          <span className="group">
            <button type="button" onClick={() => setMenu(menu === 'image' ? null : 'image')} aria-haspopup="menu">
              <ImagePlus {...ICON} /> 그림 <ChevronDown size={12} />
            </button>
            {menu === 'image' && (
              <Menu role="menu" style={{ minWidth: 260 }}>
                <label
                  className="tool"
                  style={{ width: '100%', justifyContent: 'flex-start', padding: '6px 12px', fontSize: 13 }}
                >
                  내 컴퓨터에서 고르기
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    aria-label="그림 파일 고르기"
                    onChange={(e) => {
                      onImageFile(e.target.files?.[0]);
                      e.target.value = '';
                      setMenu(null);
                    }}
                  />
                </label>
                <form onSubmit={onImageUrl}>
                  <input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https:// 그림 주소"
                    aria-label="그림 주소"
                  />
                  <button type="submit">넣기</button>
                </form>
              </Menu>
            )}
          </span>
          <button type="button" onClick={addTable} title="표" aria-label="표 넣기">
            <TableIcon {...ICON} /> 표
          </button>
          <button type="button" onClick={addChart} title="차트" aria-label="차트 넣기">
            <BarChart3 {...ICON} /> 차트
          </button>
          <span className="sep" />
          <label className="tool" title="쪽 배경색">
            <PaintBucket {...ICON} />
            <span className="swatch" style={{ background: slide.background }} />
            <input
              type="color"
              aria-label="쪽 배경색"
              value={/^#[0-9a-f]{6}$/i.test(slide.background) ? slide.background : '#ffffff'}
              onChange={(e) => updateSlide((s) => ({ ...s, background: e.target.value }))}
            />
          </label>
          <label className="tool" title="테마" style={{ paddingRight: 2 }}>
            <Palette {...ICON} />
          </label>
          <select value={theme.key} onChange={(e) => changeTheme(e.target.value)} aria-label="테마">
            {THEMES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            value={slide.transition || 'none'}
            onChange={(e) =>
              updateSlide((s) => ({
                ...s,
                transition: e.target.value === 'none' ? undefined : (e.target.value as Transition),
              }))
            }
            aria-label="쪽 전환 효과"
            title="쪽 전환 효과"
          >
            {TRANSITIONS.map(([v, label]) => (
              <option key={v} value={v}>
                전환: {label}
              </option>
            ))}
          </select>
          {tb(
            slide.hidden ? '쪽 보이기 (발표에 넣기)' : '쪽 숨기기 (발표에서 건너뛰기)',
            slide.hidden ? <EyeOff {...ICON} /> : <Eye {...ICON} />,
            () => updateSlide((s) => ({ ...s, hidden: s.hidden ? undefined : true })),
            !!slide.hidden,
          )}
          <span className="sep" />
          <select
            value={zoom === 'fit' ? 'fit' : String(zoom)}
            onChange={(e) => setZoom(e.target.value === 'fit' ? 'fit' : Number(e.target.value))}
            aria-label="확대"
          >
            <option value="fit">화면에 맞춤</option>
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((z) => (
              <option key={z} value={z}>
                {Math.round(z * 100)}%
              </option>
            ))}
          </select>
          {tb('PDF 로 저장 (인쇄)', <Printer {...ICON} />, printDeck)}
        </Bar>
      )}
      {!readOnly && primary && (
        <SubBar role="toolbar" aria-label="고른 요소 꾸미기" onClick={(e) => e.stopPropagation()}>
          {isTextLike && (
            <>
              <select
                value={primary.font || 'sans'}
                onChange={(e) =>
                  updateSelected({ font: e.target.value === 'sans' ? undefined : (e.target.value as FontKey) })
                }
                aria-label="글꼴"
              >
                {(Object.keys(FONTS) as FontKey[]).map((k) => (
                  <option key={k} value={k}>
                    {FONTS[k].name}
                  </option>
                ))}
              </select>
              <select
                value={primary.fontSize || 24}
                onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })}
                aria-label="글자 크기"
              >
                {Array.from(new Set([...FONT_SIZES, primary.fontSize || 24]))
                  .sort((a, b) => a - b)
                  .map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
              </select>
              {tb(
                '굵게 (⌘B)',
                <Bold {...ICON} />,
                () => updateSelected({ bold: !primary.bold || undefined }),
                !!primary.bold,
              )}
              {tb(
                '기울임 (⌘I)',
                <Italic {...ICON} />,
                () => updateSelected({ italic: !primary.italic || undefined }),
                !!primary.italic,
              )}
              {tb(
                '밑줄 (⌘U)',
                <Underline {...ICON} />,
                () => updateSelected({ underline: !primary.underline || undefined }),
                !!primary.underline,
              )}
              {tb(
                '취소선',
                <Strikethrough {...ICON} />,
                () => updateSelected({ strike: !primary.strike || undefined }),
                !!primary.strike,
              )}
              {(
                [
                  ['left', AlignLeft, '왼쪽 맞춤'],
                  ['center', AlignCenter, '가운데 맞춤'],
                  ['right', AlignRight, '오른쪽 맞춤'],
                ] as const
              ).map(([a, Icon, label]) => (
                <React.Fragment key={a}>
                  {tb(
                    label,
                    <Icon {...ICON} />,
                    () => updateSelected({ align: a }),
                    (primary.align || (primary.type === 'shape' ? 'center' : 'left')) === a,
                  )}
                </React.Fragment>
              ))}
              <select
                value={primary.valign || (primary.type === 'shape' ? 'middle' : 'top')}
                onChange={(e) => updateSelected({ valign: e.target.value as SlideElement['valign'] })}
                aria-label="세로 맞춤"
              >
                <option value="top">위</option>
                <option value="middle">가운데</option>
                <option value="bottom">아래</option>
              </select>
              <select
                value={primary.lineHeight || 1.3}
                onChange={(e) => updateSelected({ lineHeight: Number(e.target.value) })}
                aria-label="줄 간격"
              >
                {[1, 1.15, 1.3, 1.5, 2].map((n) => (
                  <option key={n} value={n}>
                    줄 {n}
                  </option>
                ))}
              </select>
              <label className="tool" title="글자색">
                <Type {...ICON} />
                <span className="swatch" style={{ background: primary.color || theme.text }} />
                <input
                  type="color"
                  aria-label="글자색"
                  value={primary.color || theme.text}
                  onChange={(e) => updateSelected({ color: e.target.value })}
                />
              </label>
              <span className="sep" />
            </>
          )}
          {(primary.type === 'shape' || primary.type === 'image') && (
            <>
              {primary.type === 'shape' && primary.shape !== 'line' && (
                <label className="tool" title="채우기">
                  <PaintBucket {...ICON} />
                  <span className="swatch" style={{ background: primary.fill || 'transparent' }} />
                  <input
                    type="color"
                    aria-label="도형 채우기"
                    value={primary.fill || '#ffffff'}
                    onChange={(e) => updateSelected({ fill: e.target.value })}
                  />
                </label>
              )}
              <label className="tool" title="선 색">
                <Square {...ICON} />
                <span className="swatch" style={{ background: primary.stroke || 'transparent' }} />
                <input
                  type="color"
                  aria-label="선 색"
                  value={primary.stroke || '#1d1c1d'}
                  onChange={(e) => updateSelected((x) => ({ stroke: e.target.value, strokeWidth: x.strokeWidth || 2 }))}
                />
              </label>
              <select
                value={primary.strokeWidth || 0}
                onChange={(e) =>
                  updateSelected({
                    strokeWidth: Number(e.target.value) || undefined,
                    stroke: Number(e.target.value) ? primary.stroke || '#1d1c1d' : primary.stroke,
                  })
                }
                aria-label="선 굵기"
              >
                {[0, 1, 2, 3, 4, 6, 8, 12].map((n) => (
                  <option key={n} value={n}>
                    {n ? `선 ${n}` : '선 없음'}
                  </option>
                ))}
              </select>
              <select
                value={primary.dash || 'solid'}
                onChange={(e) =>
                  updateSelected({
                    dash: e.target.value === 'solid' ? undefined : (e.target.value as SlideElement['dash']),
                  })
                }
                aria-label="선 모양"
              >
                <option value="solid">실선</option>
                <option value="dashed">파선</option>
                <option value="dotted">점선</option>
              </select>
              {(primary.type === 'image' || primary.shape === 'rect' || primary.shape === 'round') && (
                <select
                  value={primary.radius || 0}
                  onChange={(e) => updateSelected({ radius: Number(e.target.value) || undefined })}
                  aria-label="모서리"
                >
                  {[0, 6, 12, 24, 48, 999].map((n) => (
                    <option key={n} value={n}>
                      {n === 999 ? '모서리 원형' : n ? `모서리 ${n}` : '모서리 각짐'}
                    </option>
                  ))}
                </select>
              )}
              <span className="sep" />
            </>
          )}
          {primary.type === 'table' && (
            <>
              {tb('행 추가', <span style={{ fontSize: 11 }}>행+</span>, () => tableOp('addRow'))}
              {tb('행 삭제', <span style={{ fontSize: 11 }}>행−</span>, () => tableOp('delRow'))}
              {tb('열 추가', <span style={{ fontSize: 11 }}>열+</span>, () => tableOp('addCol'))}
              {tb('열 삭제', <span style={{ fontSize: 11 }}>열−</span>, () => tableOp('delCol'))}
              {tb(
                '머리글 행',
                <span style={{ fontSize: 11 }}>머리글</span>,
                () => tableOp('header'),
                !!primary.table?.header,
              )}
              <label className="tool" title="머리글 색">
                <PaintBucket {...ICON} />
                <span className="swatch" style={{ background: primary.table?.headerBg || '#1264a3' }} />
                <input
                  type="color"
                  aria-label="머리글 색"
                  value={primary.table?.headerBg || '#1264a3'}
                  onChange={(e) =>
                    primary.table && updateEls([primary.id], { table: { ...primary.table, headerBg: e.target.value } })
                  }
                />
              </label>
              <span className="sep" />
            </>
          )}
          {primary.type === 'chart' && (
            <>
              <button type="button" onClick={() => setChartEdit(primary.id)}>
                <BarChart3 {...ICON} /> 데이터 고치기
              </button>
              <span className="sep" />
            </>
          )}
          <span className="label">투명도</span>
          <input
            type="range"
            min={10}
            max={100}
            value={Math.round((primary.opacity ?? 1) * 100)}
            onChange={(e) =>
              updateSelected({ opacity: Number(e.target.value) >= 100 ? undefined : Number(e.target.value) / 100 })
            }
            aria-label="투명도"
          />
          {tb(
            '그림자',
            <span style={{ fontSize: 11 }}>그림자</span>,
            () => updateSelected({ shadow: !primary.shadow || undefined }),
            !!primary.shadow,
          )}
          <select
            value={primary.anim || 'none'}
            onChange={(e) => updateSelected({ anim: e.target.value === 'none' ? undefined : (e.target.value as Anim) })}
            aria-label="발표 애니메이션"
            title="발표할 때 누르면 나타나기"
          >
            {ANIMS.map(([v, label]) => (
              <option key={v} value={v}>
                효과: {label}
              </option>
            ))}
          </select>
          <span className="group">
            <button
              type="button"
              onClick={() => setMenu(menu === 'align' ? null : 'align')}
              aria-haspopup="menu"
              title="정렬"
            >
              <AlignCenterVertical {...ICON} /> 정렬 <ChevronDown size={12} />
            </button>
            {menu === 'align' && <Menu role="menu">{alignItems}</Menu>}
          </span>
          {tb('맨 앞으로 (⇧⌘])', <BringToFront {...ICON} />, () => zOrder('front'))}
          {tb('맨 뒤로 (⇧⌘[)', <SendToBack {...ICON} />, () => zOrder('back'))}
          {tb('복제 (⌘D)', <Copy {...ICON} />, duplicate)}
          {tb('지우기 (Delete)', <Trash2 {...ICON} />, removeSelected)}
          {selectedEls.length > 1 && <span className="label">{selectedEls.length}개 고름</span>}
        </SubBar>
      )}
      <Body>
        <Thumbs aria-label="쪽 목록">
          {deck.slides.map((s, i) => (
            <div
              key={s.id}
              className={`thumb${i === index ? ' active' : ''}`}
              onClick={() => onCurrentChange(i)}
              role="button"
              tabIndex={0}
              aria-label={`${i + 1}쪽${s.hidden ? ' (숨김)' : ''}`}
              aria-current={i === index}
              onKeyDown={(e) => e.key === 'Enter' && onCurrentChange(i)}
              draggable={!readOnly}
              onDragStart={(e) => {
                setDragThumb(i);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                if (dragThumb !== null) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragThumb !== null) moveSlideTo(dragThumb, i);
                setDragThumb(null);
              }}
              onDragEnd={() => setDragThumb(null)}
              style={{
                opacity: s.hidden ? 0.45 : undefined,
                outline: dragThumb !== null && dragThumb !== i ? '1px dashed var(--border-strong)' : undefined,
              }}
            >
              <span className="no">
                {i + 1}
                {s.hidden && <EyeOff size={10} />}
              </span>
              <div className="frame">
                <SlideView slide={s} scale={thumbScale} workspace={workspace} emojis={emojis} />
              </div>
              {!readOnly && (
                <span className="tools" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => moveSlideTo(i, i - 1)}
                    aria-label={`${i + 1}쪽 위로`}
                    title="위로"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSlideTo(i, i + 1)}
                    aria-label={`${i + 1}쪽 아래로`}
                    title="아래로"
                  >
                    <ChevronDown size={12} />
                  </button>
                  <button type="button" onClick={() => duplicateSlide(i)} aria-label={`${i + 1}쪽 복제`} title="복제">
                    <Copy size={12} />
                  </button>
                  {deck.slides.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSlide(i)}
                      aria-label={`${i + 1}쪽 지우기`}
                      title="지우기"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </span>
              )}
            </div>
          ))}
          {!readOnly && (
            <button type="button" className="add" onClick={() => addSlide('content')}>
              <Plus size={14} /> 쪽 추가
            </button>
          )}
        </Thumbs>
        <Stage ref={stageRef}>
          <div
            className="canvas-box"
            ref={canvasRef}
            tabIndex={0}
            style={{ width: W * scale, height: H * scale, flex: 'none' }}
            aria-label={`${index + 1}쪽 편집`}
            onPointerDown={readOnly ? undefined : startMarquee}
            onContextMenu={(e) => {
              if (readOnly) return;
              e.preventDefault();
              const wrap = wrapRef.current?.getBoundingClientRect();
              setCtx({ x: e.clientX - (wrap?.left || 0), y: e.clientY - (wrap?.top || 0) });
            }}
          >
            <Canvas style={{ background: slide.background, transform: `scale(${scale})` }} data-bg="1">
              {slide.elements.map((el) => {
                const r = drag?.rects[el.id];
                const shown = r ? { ...el, ...r } : el;
                const isSel = selected.includes(el.id);
                const editingThis = editingId === el.id;
                return (
                  <div
                    key={el.id}
                    className={`el${readOnly ? '' : ' editable'}${isSel ? ' selected' : ''}${
                      el.type === 'text' && !el.text ? ' empty-text' : ''
                    }`}
                    style={frameStyle(shown)}
                    onPointerDown={startDrag(el, 'move')}
                    onDoubleClick={() => startEdit(el)}
                    onContextMenu={(e) => {
                      if (!isSel) setSelected([el.id]);
                      e.stopPropagation();
                      if (readOnly) return;
                      e.preventDefault();
                      const wrap = wrapRef.current?.getBoundingClientRect();
                      setCtx({ x: e.clientX - (wrap?.left || 0), y: e.clientY - (wrap?.top || 0) });
                    }}
                    data-el={el.type}
                  >
                    <ElementBody el={shown} workspace={workspace} emojis={emojis} hideText={editingThis} />
                    {editingThis && el.type !== 'table' && (
                      <textarea
                        autoFocus
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        onBlur={finishEdit}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Escape') finishEdit();
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{ ...textStyle(el), color: '#1d1c1d', textAlign: 'left' }}
                        aria-label="글 고치기 (마크다운: # 제목, - 목록, **굵게**)"
                      />
                    )}
                    {editingThis && el.type === 'table' && draftTable && (
                      <TableEditor
                        style={{ fontSize: el.fontSize || 18 }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onBlur={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) finishEdit();
                        }}
                      >
                        <tbody>
                          {draftTable.map((row, ri) => (
                            <tr key={`r${ri}`}>
                              {row.map((cell, ci) => (
                                <td key={`c${ci}`}>
                                  <input
                                    autoFocus={ri === 0 && ci === 0}
                                    value={cell}
                                    aria-label={`${ri + 1}행 ${ci + 1}열`}
                                    onChange={(e) => {
                                      const next = draftTable.map((x) => [...x]);
                                      next[ri][ci] = e.target.value;
                                      setDraftTable(next);
                                    }}
                                    onKeyDown={(e) => {
                                      e.stopPropagation();
                                      if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey)))
                                        finishEdit();
                                    }}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </TableEditor>
                    )}
                  </div>
                );
              })}
              {primary &&
                selectedEls.length === 1 &&
                !readOnly &&
                !editingId &&
                (() => {
                  const r = drag?.rects[primary.id] || primary;
                  const rot = (drag?.rects[primary.id]?.rot ?? primary.rot) || 0;
                  return (
                    <div
                      style={{
                        position: 'absolute',
                        left: r.x,
                        top: r.y,
                        width: r.w,
                        height: r.h,
                        transform: rot ? `rotate(${rot}deg)` : undefined,
                        pointerEvents: 'none',
                      }}
                    >
                      {HANDLES.map(([h, fx, fy]) => {
                        if (primary.shape === 'line' && h !== 'e' && h !== 'w') return null;
                        return (
                          <span
                            key={h}
                            className="handle"
                            style={{
                              left: r.w * fx,
                              top: r.h * fy,
                              cursor: CURSORS[h],
                              transform: `scale(${1 / scale})`,
                              pointerEvents: 'auto',
                            }}
                            onPointerDown={startDrag(primary, h)}
                          />
                        );
                      })}
                      <span
                        className="handle"
                        title="돌리기 (Shift: 15도씩)"
                        aria-label="회전"
                        style={{
                          left: r.w / 2,
                          top: -28 / scale,
                          borderRadius: '50%',
                          cursor: CURSORS.rotate,
                          transform: `scale(${1 / scale})`,
                          pointerEvents: 'auto',
                        }}
                        onPointerDown={startDrag(primary, 'rotate')}
                      />
                    </div>
                  );
                })()}
              {drag?.guides.v.map((x) => (
                <span key={`v${x}`} className="guide" style={{ left: x, top: 0, width: 1 / scale, height: H }} />
              ))}
              {drag?.guides.h.map((y) => (
                <span key={`h${y}`} className="guide" style={{ top: y, left: 0, height: 1 / scale, width: W }} />
              ))}
              {marquee && (
                <span
                  style={{
                    position: 'absolute',
                    left: marquee.x,
                    top: marquee.y,
                    width: marquee.w,
                    height: marquee.h,
                    border: `${1 / scale}px dashed #1264a3`,
                    background: 'rgba(18,100,163,0.08)',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </Canvas>
          </div>
          {!readOnly && (
            <>
              <p className="hint" style={{ width: W * scale }}>
                두 번 눌러 고치기 · 빈 곳을 끌어 여러 개 고르기 · Shift 로 더 고르기 · 위 동그라미로 돌리기 · 오른쪽
                클릭 메뉴
              </p>
              <div className="notes" style={{ maxWidth: W * scale }}>
                <textarea
                  key={slide.id}
                  defaultValue={slide.notes || ''}
                  placeholder="발표자 메모 (발표자 보기에서만 보여요)"
                  aria-label="발표자 메모"
                  onBlur={(e) => {
                    if ((slide.notes || '') !== e.target.value)
                      updateSlide((s) => ({ ...s, notes: e.target.value || undefined }));
                  }}
                />
              </div>
            </>
          )}
        </Stage>
      </Body>
      {ctx && (
        <CtxMenu
          role="menu"
          aria-label="메뉴"
          style={{
            left: Math.min(ctx.x, (wrapRef.current?.clientWidth || 800) - 200),
            top: Math.min(ctx.y, (wrapRef.current?.clientHeight || 600) - 380),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {selectedEls.length > 0 && (
            <>
              {menuItem(
                <>
                  <Scissors {...ICON} /> 잘라내기
                </>,
                () => copy(true),
                '⌘X',
              )}
              {menuItem(
                <>
                  <Copy {...ICON} /> 복사
                </>,
                () => copy(false),
                '⌘C',
              )}
            </>
          )}
          {menuItem(
            <>
              <ClipboardPaste {...ICON} /> 붙여넣기
            </>,
            paste,
            '⌘V',
          )}
          {selectedEls.length > 0 && (
            <>
              {menuItem('복제', duplicate, '⌘D')}
              {menuItem('지우기', removeSelected, 'Delete')}
              <hr />
              {menuItem('맨 앞으로', () => zOrder('front'), '⇧⌘]')}
              {menuItem('앞으로', () => zOrder('forward'), '⌘]')}
              {menuItem('뒤로', () => zOrder('backward'), '⌘[')}
              {menuItem('맨 뒤로', () => zOrder('back'), '⇧⌘[')}
              <hr />
              {alignItems}
            </>
          )}
          {selectedEls.length === 0 && (
            <>
              <hr />
              {menuItem('모두 고르기', () => setSelected(slide.elements.map((x) => x.id)), '⌘A')}
              {menuItem('새 쪽 (제목 + 내용)', () => addSlide('content'))}
            </>
          )}
        </CtxMenu>
      )}
      {chartEl?.chart && (
        <ChartDataDialog
          key={chartEl.id}
          spec={chartEl.chart}
          onClose={() => setChartEdit(null)}
          onSave={(spec) => {
            if (chartEl) updateEls([chartEl.id], { chart: spec });
            setChartEdit(null);
          }}
        />
      )}
      {printing &&
        ReactDOM.createPortal(
          <div className="print-deck" aria-hidden="true">
            <Global
              styles={{
                '@page': { size: `${W}px ${H}px`, margin: 0 },
                '.print-deck': { display: 'none' },
                '@media print': {
                  'body > *:not(.print-deck)': { display: 'none !important' },
                  '.print-deck': { display: 'block' },
                  '.print-deck .page': { pageBreakAfter: 'always', breakAfter: 'page' },
                },
              }}
            />
            {deck.slides
              .filter((s) => !s.hidden)
              .map((s) => (
                <div className="page" key={s.id}>
                  <SlideView slide={s} scale={1} workspace={workspace} emojis={emojis} />
                </div>
              ))}
          </div>,
          document.body,
        )}
    </SlidesWrap>
  );
};

export default SlidesEditor;
