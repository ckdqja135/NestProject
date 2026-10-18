import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowRight,
  Bold,
  BringToFront,
  ChevronDown,
  ChevronUp,
  Circle,
  Copy,
  ImagePlus,
  Italic,
  LayoutTemplate,
  Minus,
  PaintBucket,
  Palette,
  Plus,
  Redo2,
  SendToBack,
  Shapes,
  Square,
  Trash2,
  Triangle,
  Type,
  Undo2,
} from 'lucide-react';
import React, { FC, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  Deck,
  H,
  Layout,
  LAYOUTS,
  makeSlide,
  newId,
  parseDeck,
  ShapeKind,
  shrinkImage,
  Slide,
  SlideElement,
  stringifyDeck,
  THEMES,
  themeOf,
  W,
} from './model';
import { Bar, Body, Menu, SlidesWrap, Stage, Thumbs } from './styles';
import SlideView, { Canvas, ElementBody } from './SlideView';

interface Props {
  value: string;
  readOnly: boolean;
  workspace: string;
  emojis?: Record<string, string>;
  current: number;
  onCurrentChange: (index: number) => void;
  onChange: (next: string) => void;
}

type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ICON = { size: 15, strokeWidth: 2 };
// 서버 본문 한도(약 1MB)보다 작게
export const MAX_DECK_SIZE = 900_000;
const SNAP = 6;
const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 60, 72, 96];
const SHAPES: { kind: ShapeKind; name: string; icon: React.ReactNode }[] = [
  { kind: 'rect', name: '사각형', icon: <Square {...ICON} /> },
  { kind: 'round', name: '둥근 사각형', icon: <Square {...ICON} style={{ borderRadius: 4 }} /> },
  { kind: 'ellipse', name: '원', icon: <Circle {...ICON} /> },
  { kind: 'triangle', name: '삼각형', icon: <Triangle {...ICON} /> },
  { kind: 'arrow', name: '화살표', icon: <ArrowRight {...ICON} /> },
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
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

// 파워포인트처럼: 왼쪽 쪽 목록, 가운데 캔버스에서 글상자·도형·그림을 끌어 놓고 크기 조절
const SlidesEditor: FC<Props> = ({ value, readOnly, workspace, emojis, current, onCurrentChange, onChange }) => {
  const deck = useMemo(() => parseDeck(value), [value]);
  const theme = themeOf(deck);
  const index = Math.max(0, Math.min(current, deck.slides.length - 1));
  const slide = deck.slides[index];
  const [selected, setSelected] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [drag, setDrag] = useState<{ id: string; rect: Rect; guides: { v?: number; h?: number } } | null>(null);
  const [menu, setMenu] = useState<'layout' | 'shape' | 'image' | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [scale, setScale] = useState(0.8);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const clipboard = useRef<SlideElement | null>(null);

  const selectedEl = slide?.elements.find((e) => e.id === selected) || null;

  // 캔버스 크기: 가운데 칸 너비에 맞춘다
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const update = () => setScale(Math.max(0.25, Math.min(1.2, (stage.clientWidth - 32) / W)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menu]);

  // 쪽을 바꾸면 고르기를 푼다
  useEffect(() => {
    setSelected(null);
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
  const updateElement = (id: string, patch: Partial<SlideElement>) =>
    updateSlide((s) => ({ ...s, elements: s.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const addElement = (el: SlideElement) => {
    if (updateSlide((s) => ({ ...s, elements: [...s.elements, el] }))) {
      setSelected(el.id);
    }
  };
  const removeElement = (id: string) => {
    updateSlide((s) => ({ ...s, elements: s.elements.filter((e) => e.id !== id) }));
    setSelected(null);
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
  const moveSlide = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= deck.slides.length) return;
    const slides = [...deck.slides];
    [slides[i], slides[j]] = [slides[j], slides[i]];
    if (commit({ ...deck, slides })) onCurrentChange(j);
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
        })),
      })),
    });
  };

  // ── 요소 넣기
  const addText = () =>
    addElement({
      id: newId(),
      type: 'text',
      x: W / 2 - 200,
      y: H / 2 - 40,
      w: 400,
      h: 80,
      text: '글을 입력하세요',
      fontSize: 28,
      color: theme.text,
    });
  const addShape = (kind: ShapeKind) =>
    addElement({
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
    });
  const addImage = (src: string, w: number, h: number) => {
    const fit = Math.min(1, 480 / w, 360 / h);
    const iw = Math.round(w * fit);
    const ih = Math.round(h * fit);
    addElement({ id: newId(), type: 'image', src, x: (W - iw) / 2, y: (H - ih) / 2, w: iw, h: ih });
  };
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

  // ── 끌기·크기 조절 (놓을 때 한 번만 저장)
  const startDrag = (el: SlideElement, handle: Handle) => (e: React.PointerEvent) => {
    if (readOnly || e.button !== 0 || editingId === el.id) return;
    e.preventDefault();
    e.stopPropagation();
    setSelected(el.id);
    canvasRef.current?.focus();
    const sx = e.clientX;
    const sy = e.clientY;
    const start: Rect = { x: el.x, y: el.y, w: el.w, h: el.h };
    const keepRatio = el.type === 'image';
    let rect = start;
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / scale;
      const dy = (ev.clientY - sy) / scale;
      if (!moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
      moved = true;
      const guides: { v?: number; h?: number } = {};
      if (handle === 'move') {
        let x = start.x + dx;
        let y = start.y + dy;
        // 가운데·가장자리에 붙이기
        const cx = x + start.w / 2;
        const cy = y + start.h / 2;
        if (Math.abs(cx - W / 2) < SNAP) {
          x = W / 2 - start.w / 2;
          guides.v = W / 2;
        } else if (Math.abs(x) < SNAP) x = 0;
        else if (Math.abs(x + start.w - W) < SNAP) x = W - start.w;
        if (Math.abs(cy - H / 2) < SNAP) {
          y = H / 2 - start.h / 2;
          guides.h = H / 2;
        } else if (Math.abs(y) < SNAP) y = 0;
        else if (Math.abs(y + start.h - H) < SNAP) y = H - start.h;
        rect = { ...start, x, y };
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
        if (keepRatio && handle.length === 2) {
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
        rect = { x, y, w, h };
      }
      setDrag({ id: el.id, rect, guides });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDrag(null);
      if (moved) {
        updateElement(el.id, {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.w),
          h: Math.round(rect.h),
        });
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // ── 글 고치기
  const startText = (el: SlideElement) => {
    if (readOnly || el.type === 'image' || el.shape === 'line') return;
    setSelected(el.id);
    setEditingId(el.id);
    setDraftText(el.text || '');
  };
  const finishText = () => {
    if (editingId) {
      const el = slide.elements.find((e) => e.id === editingId);
      if (el && (el.text || '') !== draftText) updateElement(editingId, { text: draftText });
    }
    setEditingId(null);
    canvasRef.current?.focus();
  };

  // ── 키보드 (캔버스에 포커스가 있을 때)
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editingId || readOnly) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'v' && clipboard.current) {
      e.preventDefault();
      const src = clipboard.current;
      addElement({ ...src, id: newId(), x: src.x + 20, y: src.y + 20 });
      clipboard.current = { ...src, x: src.x + 20, y: src.y + 20 };
      return;
    }
    if (!selectedEl) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      removeElement(selectedEl.id);
    } else if (e.key === 'Escape') {
      setSelected(null);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      startText(selectedEl);
    } else if (mod && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      clipboard.current = selectedEl;
    } else if (mod && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      addElement({ ...selectedEl, id: newId(), x: selectedEl.x + 20, y: selectedEl.y + 20 });
    } else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const d = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] }[e.key] || [
        0, 0,
      ];
      updateElement(selectedEl.id, { x: selectedEl.x + d[0], y: selectedEl.y + d[1] });
    }
  };

  const zOrder = (front: boolean) => {
    if (!selectedEl) return;
    updateSlide((s) => {
      const rest = s.elements.filter((e) => e.id !== selectedEl.id);
      return { ...s, elements: front ? [...rest, selectedEl] : [selectedEl, ...rest] };
    });
  };

  const thumbScale = 150 / W;
  const isText = selectedEl && selectedEl.type !== 'image' && selectedEl.shape !== 'line';

  return (
    <SlidesWrap>
      {!readOnly && (
        <Bar role="toolbar" aria-label="슬라이드 도구" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={undo}
            disabled={!undoStack.current.length}
            title="되돌리기 (⌘Z)"
            aria-label="되돌리기"
          >
            <Undo2 {...ICON} />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!redoStack.current.length}
            title="다시 하기 (⇧⌘Z)"
            aria-label="다시 하기"
          >
            <Redo2 {...ICON} />
          </button>
          <span className="sep" />
          <span className="group">
            <button type="button" onClick={() => setMenu(menu === 'layout' ? null : 'layout')} aria-haspopup="menu">
              <LayoutTemplate {...ICON} /> 새 쪽 <ChevronDown size={12} />
            </button>
            {menu === 'layout' && (
              <Menu role="menu">
                {LAYOUTS.map((l) => (
                  <button
                    key={l.key}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      addSlide(l.key);
                      setMenu(null);
                    }}
                  >
                    {l.name}
                  </button>
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
              <Menu role="menu">
                {SHAPES.map((s) => (
                  <button
                    key={s.kind}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      addShape(s.kind);
                      setMenu(null);
                    }}
                  >
                    {s.icon} {s.name}
                  </button>
                ))}
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
          {selectedEl && (
            <>
              <span className="sep" />
              {isText && (
                <>
                  <select
                    value={selectedEl.fontSize || 24}
                    onChange={(e) => updateElement(selectedEl.id, { fontSize: Number(e.target.value) })}
                    aria-label="글자 크기"
                  >
                    {FONT_SIZES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={selectedEl.bold ? 'on' : undefined}
                    onClick={() => updateElement(selectedEl.id, { bold: !selectedEl.bold })}
                    aria-label="굵게"
                    title="굵게"
                  >
                    <Bold {...ICON} />
                  </button>
                  <button
                    type="button"
                    className={selectedEl.italic ? 'on' : undefined}
                    onClick={() => updateElement(selectedEl.id, { italic: !selectedEl.italic })}
                    aria-label="기울임"
                    title="기울임"
                  >
                    <Italic {...ICON} />
                  </button>
                  {(
                    [
                      ['left', AlignLeft, '왼쪽 맞춤'],
                      ['center', AlignCenter, '가운데 맞춤'],
                      ['right', AlignRight, '오른쪽 맞춤'],
                    ] as const
                  ).map(([align, Icon, label]) => (
                    <button
                      key={align}
                      type="button"
                      className={
                        (selectedEl.align || (selectedEl.type === 'shape' ? 'center' : 'left')) === align
                          ? 'on'
                          : undefined
                      }
                      onClick={() => updateElement(selectedEl.id, { align })}
                      aria-label={label}
                      title={label}
                    >
                      <Icon {...ICON} />
                    </button>
                  ))}
                  <label className="tool" title="글자색">
                    <Type {...ICON} />
                    <span className="swatch" style={{ background: selectedEl.color || theme.text }} />
                    <input
                      type="color"
                      aria-label="글자색"
                      value={selectedEl.color || theme.text}
                      onChange={(e) => updateElement(selectedEl.id, { color: e.target.value })}
                    />
                  </label>
                </>
              )}
              {selectedEl.type === 'shape' && (
                <>
                  {selectedEl.shape !== 'line' && (
                    <label className="tool" title="도형 채우기">
                      <PaintBucket {...ICON} />
                      <span className="swatch" style={{ background: selectedEl.fill || 'transparent' }} />
                      <input
                        type="color"
                        aria-label="도형 채우기"
                        value={selectedEl.fill || '#ffffff'}
                        onChange={(e) => updateElement(selectedEl.id, { fill: e.target.value })}
                      />
                    </label>
                  )}
                  <label className="tool" title="선 색">
                    <Square {...ICON} />
                    <span className="swatch" style={{ background: selectedEl.stroke || 'transparent' }} />
                    <input
                      type="color"
                      aria-label="선 색"
                      value={selectedEl.stroke || '#1d1c1d'}
                      onChange={(e) =>
                        updateElement(selectedEl.id, {
                          stroke: e.target.value,
                          strokeWidth: selectedEl.strokeWidth || 2,
                        })
                      }
                    />
                  </label>
                </>
              )}
              <button type="button" onClick={() => zOrder(true)} title="맨 앞으로" aria-label="맨 앞으로">
                <BringToFront {...ICON} />
              </button>
              <button type="button" onClick={() => zOrder(false)} title="맨 뒤로" aria-label="맨 뒤로">
                <SendToBack {...ICON} />
              </button>
              <button
                type="button"
                onClick={() => removeElement(selectedEl.id)}
                title="지우기 (Delete)"
                aria-label="고른 것 지우기"
              >
                <Trash2 {...ICON} />
              </button>
            </>
          )}
        </Bar>
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
              aria-label={`${i + 1}쪽`}
              aria-current={i === index}
              onKeyDown={(e) => e.key === 'Enter' && onCurrentChange(i)}
            >
              <span className="no">{i + 1}</span>
              <div className="frame">
                <SlideView slide={s} scale={thumbScale} workspace={workspace} emojis={emojis} />
              </div>
              {!readOnly && (
                <span className="tools" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => moveSlide(i, -1)} aria-label={`${i + 1}쪽 위로`} title="위로">
                    <ChevronUp size={12} />
                  </button>
                  <button type="button" onClick={() => moveSlide(i, 1)} aria-label={`${i + 1}쪽 아래로`} title="아래로">
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
            onKeyDown={onKeyDown}
            style={{ width: W * scale, height: H * scale }}
            aria-label={`${index + 1}쪽 편집`}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.bg) {
                if (editingId) finishText();
                setSelected(null);
              }
            }}
          >
            <Canvas style={{ background: slide.background, transform: `scale(${scale})` }} data-bg="1">
              {slide.elements.map((el) => {
                const rect = drag?.id === el.id ? drag.rect : el;
                const isSel = selected === el.id;
                const editingThis = editingId === el.id;
                return (
                  <div
                    key={el.id}
                    className={`el${readOnly ? '' : ' editable'}${isSel ? ' selected' : ''}${
                      el.type === 'text' && !el.text ? ' empty-text' : ''
                    }`}
                    style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
                    onPointerDown={startDrag(el, 'move')}
                    onDoubleClick={() => startText(el)}
                    data-el={el.type}
                  >
                    <ElementBody el={{ ...el, ...rect }} workspace={workspace} emojis={emojis} hideText={editingThis} />
                    {editingThis && (
                      <textarea
                        autoFocus
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        onBlur={finishText}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Escape') finishText();
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{ fontSize: el.fontSize || 24, fontWeight: el.bold ? 700 : undefined }}
                        aria-label="글 고치기 (마크다운: # 제목, - 목록, **굵게**)"
                      />
                    )}
                  </div>
                );
              })}
              {selectedEl &&
                !readOnly &&
                !editingId &&
                HANDLES.map(([h, fx, fy]) => {
                  const rect = drag?.id === selectedEl.id ? drag.rect : selectedEl;
                  if (selectedEl.shape === 'line' && h !== 'e' && h !== 'w') return null;
                  return (
                    <span
                      key={h}
                      className="handle"
                      style={{
                        left: rect.x + rect.w * fx,
                        top: rect.y + rect.h * fy,
                        cursor: CURSORS[h],
                        transform: `scale(${1 / scale})`,
                      }}
                      onPointerDown={startDrag(selectedEl, h)}
                    />
                  );
                })}
              {drag?.guides.v !== undefined && (
                <span className="guide" style={{ left: drag.guides.v, top: 0, width: 1, height: H }} />
              )}
              {drag?.guides.h !== undefined && (
                <span className="guide" style={{ top: drag.guides.h, left: 0, height: 1, width: W }} />
              )}
            </Canvas>
          </div>
          {!readOnly && (
            <>
              <p className="hint" style={{ width: W * scale }}>
                두 번 눌러 글 고치기 · 끌어서 옮기기 · 모서리로 크기 조절 · Delete 지우기 · ⌘D 복제
              </p>
              <div className="notes" style={{ maxWidth: W * scale }}>
                <textarea
                  key={slide.id}
                  defaultValue={slide.notes || ''}
                  placeholder="발표자 메모 (발표 화면에는 나오지 않아요)"
                  aria-label="발표자 메모"
                  onBlur={(e) => {
                    if ((slide.notes || '') !== e.target.value) updateSlide((s) => ({ ...s, notes: e.target.value }));
                  }}
                />
              </div>
            </>
          )}
        </Stage>
      </Body>
    </SlidesWrap>
  );
};

export default SlidesEditor;
