import Chart, { tableToChart } from '@pages/Docs/chart/Chart';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowDownAZ,
  ArrowUpAZ,
  BarChart3,
  Bold,
  ChevronDown,
  ClipboardPaste,
  Copy,
  Download,
  Eraser,
  FileUp,
  Filter as FilterIcon,
  Grid2x2,
  Highlighter,
  Italic,
  ListChecks,
  Merge,
  MessageSquareText,
  PaintBucket,
  Plus,
  Redo2,
  Scissors,
  Search,
  Sigma,
  Snowflake,
  SquareDashed,
  Strikethrough,
  Trash2,
  Type,
  Underline,
  Undo2,
  WrapText,
  X,
} from 'lucide-react';
import React, { FC, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { ChartDialog, ConditionalDialog, FilterMenu, NoteDialog, ValidationDialog } from './dialogs';
import { cellKey, colName, createEvaluator, FormulaError, FUNCTION_NAMES, parseRef } from './formula';
import {
  Align,
  Cell,
  ChartType,
  currentRegion,
  display,
  emptySheet,
  formatOf,
  heightOf,
  inRange,
  insertLines,
  MAX_COLS,
  MAX_ROWS,
  moveFormula,
  newId,
  norm,
  NumberFormat,
  overlaps,
  parseDelimited,
  parseRange,
  parseWorkbook,
  Range,
  rangeName,
  Sheet,
  SheetChart,
  stringifyWorkbook,
  toCsv,
  usedBounds,
  VAlign,
  widthOf,
  Workbook,
} from './model';
import { columnValues, fillCells, filteredRows, mergeAt, ruleStyles, sortRange } from './ops';
import {
  FindBar,
  FormulaBar,
  HEADER_H,
  HEADER_W,
  PopMenu,
  SheetToolbar,
  SheetWrap,
  StatusBar,
  Viewport,
} from './styles';

interface Props {
  value: string;
  readOnly: boolean;
  title?: string;
  onChange: (next: string) => void;
}

interface Pos {
  c: number;
  r: number;
}

interface Editing extends Pos {
  text: string;
  fromBar: boolean;
  // enter: 글자를 쳐서 시작 (방향키로 끝내고 이동), edit: F2·두 번 누르기 (방향키는 글 안에서)
  mode: 'enter' | 'edit';
}

type Menu =
  | { kind: 'cell' | 'row' | 'col'; x: number; y: number }
  | { kind: 'filter'; x: number; y: number; c: number }
  | { kind: 'tab'; x: number; y: number; index: number };

const ICON = { size: 15, strokeWidth: 2 };
const FORMATS: [NumberFormat, string][] = [
  ['general', '자동'],
  ['number', '숫자 1,234.5'],
  ['currency', '원화 ₩'],
  ['percent', '퍼센트 %'],
  ['date', '날짜'],
  ['text', '글자'],
];
const FONT_SIZES = [9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 36];
const EMPTY: Cell = { v: '' };

const isEmptyCell = (cell: Cell) =>
  !cell.v &&
  !cell.b &&
  !cell.i &&
  !cell.u &&
  !cell.s &&
  !cell.fs &&
  !cell.align &&
  !cell.valign &&
  !cell.wrap &&
  !cell.color &&
  !cell.bg &&
  !cell.fmt &&
  cell.dp === undefined &&
  !cell.border &&
  !cell.note &&
  !cell.list;

// 오른쪽 클릭·도구 메뉴 바깥을 누르면 닫는다
const useOutside = (open: boolean, close: () => void) => {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = () => close();
    const t = window.setTimeout(() => window.addEventListener('mousedown', onDown), 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('mousedown', onDown);
    };
  }, [open, close]);
};

// 엑셀처럼 쓰는 스프레드시트. 고친 내용은 통합 문서 JSON 으로 onChange 에 넘긴다
const SheetEditor: FC<Props> = ({ value, readOnly, title, onChange }) => {
  const book = useMemo(() => parseWorkbook(value), [value]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const index = Math.min(sheetIndex, book.sheets.length - 1);
  const sheet = book.sheets[index];
  const [anchor, setAnchor] = useState<Pos>({ c: 0, r: 0 });
  const [focus, setFocus] = useState<Pos>({ c: 0, r: 0 });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [suggestIndex, setSuggestIndex] = useState(0);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [toolMenu, setToolMenu] = useState<string | null>(null);
  // 도구 메뉴를 편집기 안에 들어오게 놓을 가로 위치 (단추 기준)
  const [toolLeft, setToolLeft] = useState(0);
  const [dialog, setDialog] = useState<'cond' | 'valid' | 'chart' | 'note' | null>(null);
  const [chartEdit, setChartEdit] = useState<SheetChart | null>(null);
  const [selectedChart, setSelectedChart] = useState<string | null>(null);
  const [chartDrag, setChartDrag] = useState<{ id: string; x: number; y: number; w: number; h: number } | null>(null);
  const [find, setFind] = useState<{ q: string; rep: string; idx: number } | null>(null);
  const [fillTarget, setFillTarget] = useState<Range | null>(null);
  const [scroll, setScroll] = useState({ left: 0, top: 0, w: 800, h: 500 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const valueRef = useRef(value);
  valueRef.current = value;
  const dragging = useRef<'select' | 'fill' | null>(null);
  const fillRef = useRef<Range | null>(null);
  const clipboard = useRef<{ text: string; origin: Pos; cells: (Cell | undefined)[][]; cut: Range | null } | null>(
    null,
  );

  const sel = norm(anchor, focus);
  const evaluator = useMemo(() => createEvaluator((key) => sheet.cells[key]?.v), [sheet]);
  const valueAt = evaluator.valueAt;
  const hiddenRows = useMemo(() => filteredRows(sheet, valueAt), [sheet, valueAt]);
  const merges = useMemo(() => mergeAt(sheet), [sheet]);
  const ruleStyle = useMemo(() => ruleStyles(sheet.rules, valueAt), [sheet.rules, valueAt]);
  // 열·행 위치 (숨긴 줄은 0)
  const colX = useMemo(() => {
    const xs = [0];
    for (let c = 0; c < sheet.cols; c += 1) xs.push(xs[c] + widthOf(sheet, c));
    return xs;
  }, [sheet]);
  const rowY = useMemo(() => {
    const ys = [0];
    for (let r = 0; r < sheet.rows; r += 1) ys.push(ys[r] + (hiddenRows.has(r) ? 0 : heightOf(sheet, r)));
    return ys;
  }, [sheet, hiddenRows]);
  const fr = Math.min(sheet.freeze?.r || 0, sheet.rows);
  const fc = Math.min(sheet.freeze?.c || 0, sheet.cols);
  const frozenH = rowY[fr];
  const frozenW = colX[fc];
  const totalW = colX[sheet.cols];
  const totalH = rowY[sheet.rows];

  // ── 바꾸기 (되돌리기 기록과 함께)
  const commit = useCallback(
    (next: Workbook) => {
      const text = stringifyWorkbook(next);
      if (text === valueRef.current) return;
      if (text.length > 900_000) {
        toast.error('시트가 너무 큽니다. 내용을 나눠 주세요.', { position: 'bottom-center' });
        return;
      }
      undoStack.current.push(valueRef.current);
      if (undoStack.current.length > 100) undoStack.current.shift();
      redoStack.current = [];
      onChange(text);
    },
    [onChange],
  );
  const updateSheet = (fn: (s: Sheet) => Sheet) => {
    if (readOnly) return;
    commit({ ...book, sheets: book.sheets.map((s, i) => (i === index ? fn(s) : s)) });
  };
  const applyCells = (s: Sheet, changes: Record<string, Partial<Cell> | null>): Sheet => {
    const cells = { ...s.cells };
    Object.entries(changes).forEach(([key, change]) => {
      if (change === null) {
        delete cells[key];
        return;
      }
      const merged = { ...EMPTY, ...cells[key], ...change } as Cell;
      const loose = merged as unknown as Record<string, unknown>;
      Object.keys(loose).forEach((k) => {
        if (loose[k] === undefined) delete loose[k];
      });
      if (isEmptyCell(merged)) delete cells[key];
      else cells[key] = merged;
    });
    return { ...s, cells };
  };
  const setCells = (changes: Record<string, Partial<Cell> | null>) => updateSheet((s) => applyCells(s, changes));
  const forRange = (range: Range, fn: (key: string, cell?: Cell) => Partial<Cell> | null) => {
    const changes: Record<string, Partial<Cell> | null> = {};
    for (let r = range.r1; r <= range.r2; r += 1) {
      if (hiddenRows.has(r)) continue;
      for (let c = range.c1; c <= range.c2; c += 1) {
        const key = cellKey(c, r);
        changes[key] = fn(key, sheet.cells[key]);
      }
    }
    setCells(changes);
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

  // ── 화면 크기·스크롤
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    const update = () => setScroll({ left: el.scrollLeft, top: el.scrollTop, w: el.clientWidth, h: el.clientHeight });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, []);
  // 머리글·고정 칸 위에서 굴려도 시트가 움직이게
  const onWheel = (e: React.WheelEvent) => {
    if ((e.target as HTMLElement).closest('.scroller')) return;
    scrollerRef.current?.scrollBy(e.deltaX, e.deltaY);
  };

  // ── 고르기·움직이기
  const clamp = (p: Pos): Pos => ({
    c: Math.max(0, Math.min(sheet.cols - 1, p.c)),
    r: Math.max(0, Math.min(sheet.rows - 1, p.r)),
  });
  const select = (p: Pos, extend = false) => {
    const next = clamp(p);
    if (!extend) setAnchor(next);
    setFocus(next);
    setSelectedChart(null);
  };
  // 숨긴 줄을 건너뛰며 이동 (toEdge: Cmd+방향키로 데이터 끝까지)
  const step = (from: Pos, dc: number, dr: number, toEdge: boolean): Pos => {
    const hiddenC = new Set(sheet.hiddenCols || []);
    const filled = (cc: number, rr: number) => !!sheet.cells[cellKey(cc, rr)]?.v;
    let { c, r } = from;
    const limit = toEdge ? Math.max(sheet.rows, sheet.cols) : 1;
    for (let i = 0; i < limit; i += 1) {
      let nc = c + dc;
      let nr = r + dr;
      while (nr >= 0 && nr < sheet.rows && hiddenRows.has(nr)) nr += dr || 1;
      while (nc >= 0 && nc < sheet.cols && hiddenC.has(nc)) nc += dc || 1;
      if (nc < 0 || nr < 0 || nc >= sheet.cols || nr >= sheet.rows) break;
      if (toEdge && i > 0 && filled(c, r) !== filled(nc, nr)) {
        if (!filled(c, r)) {
          c = nc;
          r = nr;
        }
        break;
      }
      c = nc;
      r = nr;
    }
    return { c, r };
  };

  // 고른 칸이 보이게 스크롤
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || focus.r < fr || focus.c < fc) return;
    const top = rowY[focus.r];
    const bottom = rowY[focus.r + 1];
    if (top < el.scrollTop + frozenH) el.scrollTop = top - frozenH;
    else if (bottom > el.scrollTop + el.clientHeight - HEADER_H) el.scrollTop = bottom - el.clientHeight + HEADER_H;
    const left = colX[focus.c];
    const right = colX[focus.c + 1];
    if (left < el.scrollLeft + frozenW) el.scrollLeft = left - frozenW;
    else if (right > el.scrollLeft + el.clientWidth - HEADER_W) el.scrollLeft = right - el.clientWidth + HEADER_W;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  // 시트를 바꾸면 처음 칸으로
  useEffect(() => {
    setAnchor({ c: 0, r: 0 });
    setFocus({ c: 0, r: 0 });
    setEditing(null);
    setSelectedChart(null);
    scrollerRef.current?.scrollTo(0, 0);
  }, [index]);

  const closeMenu = useCallback(() => setMenu(null), []);
  const closeTool = useCallback(() => setToolMenu(null), []);
  useOutside(!!menu, closeMenu);
  useOutside(!!toolMenu, closeTool);

  // 키 입력은 고른 칸 위에 늘 있는 입력칸이 받는다 (한글 등 IME 조합이 끊기지 않게)
  const focusGrid = () => editRef.current?.focus({ preventScroll: true });

  // ── 고치기
  const startEdit = (p: Pos, text?: string, fromBar = false, mode: 'enter' | 'edit' = 'edit') => {
    if (readOnly) return;
    setEditing({ ...p, text: text ?? sheet.cells[cellKey(p.c, p.r)]?.v ?? '', fromBar, mode });
    setSuggestIndex(0);
  };
  useEffect(() => {
    if (editing && !editing.fromBar) {
      const el = editRef.current;
      el?.focus({ preventScroll: true });
      if (editing.mode === 'edit') el?.setSelectionRange(el.value.length, el.value.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.c, editing?.r, editing?.fromBar]);

  const editingCell = editing ? sheet.cells[cellKey(editing.c, editing.r)] : undefined;
  // 수식 함수 이름·드롭다운 목록 추천
  const suggestions = useMemo(() => {
    if (!editing) return [];
    if (editingCell?.list) {
      const q = editing.text.trim().toLowerCase();
      return editingCell.list.filter((v) => v.toLowerCase().includes(q)).slice(0, 50);
    }
    if (!editing.text.startsWith('=')) return [];
    const m = /([A-Za-z]+)$/.exec(editing.text);
    if (!m) return [];
    const head = m[1].toUpperCase();
    return FUNCTION_NAMES.filter((f) => f.startsWith(head) && f !== head).slice(0, 8);
  }, [editing, editingCell]);

  const finishEdit = (move?: Pos, forced?: string) => {
    if (editing) {
      const key = cellKey(editing.c, editing.r);
      const text = forced ?? editing.text;
      const cell = sheet.cells[key];
      if (cell?.list && text.trim() && !cell.list.includes(text.trim())) {
        toast.error(
          `목록에 있는 값만 넣을 수 있습니다: ${cell.list.slice(0, 5).join(', ')}${cell.list.length > 5 ? ' …' : ''}`,
          {
            position: 'bottom-center',
          },
        );
        return;
      }
      if ((cell?.v ?? '') !== text) setCells({ [key]: { v: text } });
      setEditing(null);
      if (move) select(step({ c: editing.c, r: editing.r }, move.c, move.r, false));
    }
    focusGrid();
  };
  const cancelEdit = () => {
    setEditing(null);
    focusGrid();
  };
  const acceptSuggestion = (s: string) => {
    if (!editing) return;
    if (editingCell?.list) {
      finishEdit({ c: 0, r: 1 }, s);
      return;
    }
    setEditing({ ...editing, text: editing.text.replace(/([A-Za-z]+)$/, `${s}(`) });
    setSuggestIndex(0);
    requestAnimationFrame(() => (editing.fromBar ? barRef.current : editRef.current)?.focus());
  };

  const onEditKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (suggestions.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestIndex((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && editingCell?.list)) {
        e.preventDefault();
        acceptSuggestion(suggestions[Math.min(suggestIndex, suggestions.length - 1)]);
        return;
      }
    }
    const arrows: Record<string, Pos> = {
      ArrowUp: { c: 0, r: -1 },
      ArrowDown: { c: 0, r: 1 },
      ArrowLeft: { c: -1, r: 0 },
      ArrowRight: { c: 1, r: 0 },
    };
    if (arrows[e.key] && editing?.mode === 'enter' && !editing.fromBar && !e.nativeEvent.isComposing) {
      e.preventDefault();
      finishEdit(arrows[e.key]);
      return;
    }
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      finishEdit({ c: 0, r: e.shiftKey ? -1 : 1 });
    } else if (e.key === 'Tab') {
      e.preventDefault();
      finishEdit({ c: e.shiftKey ? -1 : 1, r: 0 });
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  // ── 꾸미기
  const activeCell = sheet.cells[cellKey(anchor.c, anchor.r)];
  const toggle = (prop: 'b' | 'i' | 'u' | 's' | 'wrap') => {
    const on = !activeCell?.[prop];
    forRange(sel, () => ({ [prop]: on || undefined }));
  };
  const setAlign = (align: Align) => forRange(sel, () => ({ align: activeCell?.align === align ? undefined : align }));
  const setVAlign = (valign: VAlign) => forRange(sel, () => ({ valign: valign === 'bottom' ? undefined : valign }));
  const setColor = (prop: 'color' | 'bg', color: string | undefined) => forRange(sel, () => ({ [prop]: color }));
  const setFormat = (fmt: NumberFormat) => forRange(sel, () => ({ fmt: fmt === 'general' ? undefined : fmt }));
  const changeDecimals = (delta: number) =>
    forRange(sel, (key, cell) => {
      const p = parseRef(key);
      const v = p ? valueAt(p.c, p.r) : null;
      let base = cell?.dp;
      if (base === undefined) {
        const s = typeof v === 'number' ? String(v) : '';
        base = s.includes('.') ? Math.min(6, s.split('.')[1].length) : 0;
      }
      return { dp: Math.max(0, Math.min(10, base + delta)) };
    });
  const setBorders = (kind: 'all' | 'outer' | 'bottom' | 'none') =>
    forRange(sel, (key, cell) => {
      const p = parseRef(key);
      if (!p) return {};
      if (kind === 'none') return { border: undefined };
      if (kind === 'all') return { border: { t: true, r: true, b: true, l: true } };
      if (kind === 'bottom') return p.r === sel.r2 ? { border: { ...cell?.border, b: true } } : {};
      return {
        border: {
          ...cell?.border,
          t: p.r === sel.r1 || cell?.border?.t || undefined,
          b: p.r === sel.r2 || cell?.border?.b || undefined,
          l: p.c === sel.c1 || cell?.border?.l || undefined,
          r: p.c === sel.c2 || cell?.border?.r || undefined,
        },
      };
    });
  const clearFormats = () =>
    forRange(sel, (key, cell) =>
      cell
        ? {
            b: undefined,
            i: undefined,
            u: undefined,
            s: undefined,
            fs: undefined,
            align: undefined,
            valign: undefined,
            wrap: undefined,
            color: undefined,
            bg: undefined,
            fmt: undefined,
            dp: undefined,
            border: undefined,
          }
        : null,
    );

  // ── 병합
  const mergeAtAnchor = merges.get(cellKey(anchor.c, anchor.r));
  const toggleMerge = () => {
    if (readOnly) return;
    if (
      mergeAtAnchor &&
      sel.c1 >= mergeAtAnchor.c1 &&
      sel.c2 <= mergeAtAnchor.c2 &&
      sel.r1 >= mergeAtAnchor.r1 &&
      sel.r2 <= mergeAtAnchor.r2
    ) {
      updateSheet((s) => ({ ...s, merges: (s.merges || []).filter((m) => m !== rangeName(mergeAtAnchor)) }));
      return;
    }
    if (sel.c1 === sel.c2 && sel.r1 === sel.r2) return;
    const lost: string[] = [];
    for (let r = sel.r1; r <= sel.r2; r += 1) {
      for (let c = sel.c1; c <= sel.c2; c += 1) {
        if ((c !== sel.c1 || r !== sel.r1) && sheet.cells[cellKey(c, r)]?.v) lost.push(cellKey(c, r));
      }
    }
    if (lost.length && !window.confirm('병합하면 왼쪽 위 칸의 값만 남습니다. 계속할까요?')) return;
    updateSheet((s) => {
      const next = lost.length ? applyCells(s, Object.fromEntries(lost.map((k) => [k, { v: '' }]))) : s;
      const kept = (next.merges || []).filter((m) => {
        const r = parseRange(m);
        return r && !overlaps(r, sel);
      });
      return { ...next, merges: [...kept, rangeName(sel)] };
    });
    setFocus(anchor);
  };

  // ── 자동 합계 (Σ): 함수 고르기
  const autoFn = (fn: string) => {
    if (readOnly) return;
    if (sel.r1 === sel.r2 && sel.c1 === sel.c2) {
      let top = sel.r1 - 1;
      while (top >= 0 && typeof valueAt(sel.c1, top) === 'number') top -= 1;
      if (top === sel.r1 - 1) {
        startEdit(anchor, `=${fn}()`);
        return;
      }
      setCells({
        [cellKey(sel.c1, sel.r1)]: { v: `=${fn}(${cellKey(sel.c1, top + 1)}:${cellKey(sel.c1, sel.r1 - 1)})` },
      });
      return;
    }
    const r = Math.min(sel.r2 + 1, sheet.rows - 1);
    const changes: Record<string, Partial<Cell>> = {};
    for (let c = sel.c1; c <= sel.c2; c += 1) {
      changes[cellKey(c, r)] = { v: `=${fn}(${cellKey(c, sel.r1)}:${cellKey(c, sel.r2)})` };
    }
    setCells(changes);
  };

  // ── 행·열
  const lines = (axis: 'row' | 'col', where: 'before' | 'after' | 'delete') => {
    if (readOnly) return;
    const start = axis === 'row' ? sel.r1 : sel.c1;
    const end = axis === 'row' ? sel.r2 : sel.c2;
    const count = end - start + 1;
    if (where === 'delete') {
      const total = axis === 'row' ? sheet.rows : sheet.cols;
      if (count >= total) return;
      updateSheet((s) => insertLines(s, axis, start, -count));
      select({ c: sel.c1, r: sel.r1 });
      return;
    }
    const n = Math.min(count, axis === 'row' ? MAX_ROWS - sheet.rows : MAX_COLS - sheet.cols);
    if (n <= 0) {
      toast.error(axis === 'row' ? `행은 ${MAX_ROWS}개까지입니다.` : `열은 ${MAX_COLS}개까지입니다.`, {
        position: 'bottom-center',
      });
      return;
    }
    updateSheet((s) => insertLines(s, axis, where === 'before' ? start : end + 1, n));
  };
  const hideLines = (axis: 'row' | 'col', hide: boolean) =>
    updateSheet((s) => {
      const key = axis === 'row' ? 'hiddenRows' : 'hiddenCols';
      const [a, b] = axis === 'row' ? [sel.r1, sel.r2] : [sel.c1, sel.c2];
      const set = new Set(s[key] || []);
      // 숨기기 취소는 고른 범위 양옆까지
      for (let i = hide ? a : a - 1; i <= (hide ? b : b + 1); i += 1) {
        if (hide) set.add(i);
        else set.delete(i);
      }
      return { ...s, [key]: Array.from(set).sort((x, y) => x - y) };
    });
  const resetSize = (axis: 'row' | 'col') =>
    updateSheet((s) => {
      if (axis === 'col') {
        const widths = { ...s.widths };
        for (let c = sel.c1; c <= sel.c2; c += 1) delete widths[colName(c)];
        return { ...s, widths };
      }
      const heights = { ...(s.heights || {}) };
      for (let r = sel.r1; r <= sel.r2; r += 1) delete heights[String(r + 1)];
      return { ...s, heights };
    });

  // ── 정렬·필터
  const looksLikeHeader = (range: Range) => {
    if (range.r2 <= range.r1) return false;
    let text = 0;
    let bold = false;
    for (let c = range.c1; c <= range.c2; c += 1) {
      const v = valueAt(c, range.r1);
      if (typeof v === 'string' && v) text += 1;
      if (sheet.cells[cellKey(c, range.r1)]?.b) bold = true;
    }
    const second = valueAt(anchor.c, range.r1 + 1);
    return text === range.c2 - range.c1 + 1 && (bold || typeof second !== 'string');
  };
  const sortBy = (desc: boolean, col = anchor.c, rangeIn?: Range, header?: boolean) => {
    if (readOnly) return;
    const multi = sel.r1 !== sel.r2 || sel.c1 !== sel.c2;
    const range = rangeIn || (multi ? sel : currentRegion(sheet, anchor.c, anchor.r));
    const hasHeader = header ?? looksLikeHeader(range);
    updateSheet((s) => sortRange(s, range, col, desc, hasHeader, valueAt));
    toast.info(
      `${colName(col)}열 기준 ${desc ? '내림차순' : '오름차순'}으로 정렬했습니다${
        hasHeader ? ' (첫 행은 머리글)' : ''
      }.`,
      {
        position: 'bottom-center',
      },
    );
  };
  const filterRange = sheet.filter ? parseRange(sheet.filter.range) : null;
  const toggleFilter = () => {
    if (readOnly) return;
    if (sheet.filter) {
      updateSheet((s) => ({ ...s, filter: undefined }));
      return;
    }
    const multi = sel.r1 !== sel.r2 || sel.c1 !== sel.c2;
    const range = multi ? sel : currentRegion(sheet, anchor.c, anchor.r);
    if (range.r2 <= range.r1) {
      toast.error('머리글 아래에 데이터가 있는 범위를 골라 주세요.', { position: 'bottom-center' });
      return;
    }
    updateSheet((s) => ({ ...s, filter: { range: rangeName(range), hidden: {} } }));
  };

  // ── 틀 고정
  const setFreeze = (r: number, c: number) => updateSheet((s) => ({ ...s, freeze: r || c ? { r, c } : undefined }));

  // ── 채우기 (Ctrl+D 아래로, Ctrl+R 오른쪽으로)
  const fillDir = (dir: 'down' | 'right') => {
    if (readOnly) return;
    if ((dir === 'down' && sel.r2 === sel.r1) || (dir === 'right' && sel.c2 === sel.c1)) return;
    const src = dir === 'down' ? { ...sel, r2: sel.r1 } : { ...sel, c2: sel.c1 };
    setCells(fillCells(sheet, src, sel));
  };

  // ── 복사·붙여넣기 (다른 프로그램과는 탭으로 나눈 글)
  const rangeText = (range: Range) => {
    const out: string[] = [];
    for (let r = range.r1; r <= range.r2; r += 1) {
      if (hiddenRows.has(r)) continue;
      const row: string[] = [];
      for (let c = range.c1; c <= range.c2; c += 1) {
        const cell = sheet.cells[cellKey(c, r)];
        row.push(cell ? display(valueAt(c, r), formatOf(cell), cell.dp) : '');
      }
      out.push(row.join('\t'));
    }
    return out.join('\n');
  };
  const copySel = (cut: boolean) => {
    const text = rangeText(sel);
    const cells: (Cell | undefined)[][] = [];
    for (let r = sel.r1; r <= sel.r2; r += 1) {
      const row: (Cell | undefined)[] = [];
      for (let c = sel.c1; c <= sel.c2; c += 1) row.push(sheet.cells[cellKey(c, r)]);
      cells.push(row);
    }
    clipboard.current = { text, origin: { c: sel.c1, r: sel.r1 }, cells, cut: cut ? sel : null };
    return text;
  };
  const pasteText = (text: string) => {
    if (readOnly) return;
    const changes: Record<string, Partial<Cell> | null> = {};
    const own = clipboard.current;
    if (own && own.text === text) {
      const h = own.cells.length;
      const w = own.cells[0]?.length || 1;
      // 한 칸을 복사해 여러 칸에 붙이면 고른 칸 모두에
      const rows = h === 1 && w === 1 ? sel.r2 - sel.r1 + 1 : h;
      const cols = h === 1 && w === 1 ? sel.c2 - sel.c1 + 1 : w;
      if (own.cut) {
        for (let r = own.cut.r1; r <= own.cut.r2; r += 1) {
          for (let c = own.cut.c1; c <= own.cut.c2; c += 1) changes[cellKey(c, r)] = null;
        }
      }
      for (let dr = 0; dr < rows; dr += 1) {
        for (let dc = 0; dc < cols; dc += 1) {
          const sr = dr % h;
          const sc = dc % w;
          const cell = own.cells[sr][sc];
          const c = sel.c1 + dc;
          const r = sel.r1 + dr;
          if (c >= sheet.cols || r >= sheet.rows) continue;
          changes[cellKey(c, r)] = cell
            ? { ...EMPTY, ...cell, v: moveFormula(cell.v, c - (own.origin.c + sc), r - (own.origin.r + sr)) }
            : null;
        }
      }
      if (own.cut) clipboard.current = null;
    } else {
      Object.entries(parseDelimited(text, '\t', sel.c1, sel.r1)).forEach(([k, cell]) => {
        changes[k] = { v: cell.v };
      });
    }
    setCells(changes);
  };
  const fromOtherInput = (e: React.SyntheticEvent) =>
    (e.target as HTMLElement).tagName === 'INPUT' && !(e.target as HTMLElement).classList.contains('cell-input');
  const onCopy = (e: React.ClipboardEvent) => {
    if (editing || fromOtherInput(e)) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', copySel(false));
  };
  const onCut = (e: React.ClipboardEvent) => {
    if (editing || readOnly || fromOtherInput(e)) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', copySel(true));
  };
  const onPaste = (e: React.ClipboardEvent) => {
    if (editing || readOnly || fromOtherInput(e)) return;
    e.preventDefault();
    pasteText(e.clipboardData.getData('text/plain'));
  };
  const menuPaste = () => {
    if (clipboard.current) {
      pasteText(clipboard.current.text);
      return;
    }
    navigator.clipboard
      ?.readText()
      .then(pasteText)
      .catch(() => toast.info('⌘V 로 붙여 넣어 주세요.', { position: 'bottom-center' }));
  };

  // ── 찾기·바꾸기
  const matches = useMemo(() => {
    if (!find || !find.q) return [] as Pos[];
    const q = find.q.toLowerCase();
    const out: Pos[] = [];
    Object.entries(sheet.cells).forEach(([key, cell]) => {
      const p = parseRef(key);
      if (!p || hiddenRows.has(p.r)) return;
      const shown = display(valueAt(p.c, p.r), formatOf(cell), cell.dp).toLowerCase();
      if (shown.includes(q) || cell.v.toLowerCase().includes(q)) out.push(p);
    });
    return out.sort((a, b) => a.r - b.r || a.c - b.c);
  }, [find, sheet.cells, valueAt, hiddenRows]);
  const goMatch = (delta: number) => {
    if (!find || !matches.length) return;
    const idx = (find.idx + delta + matches.length) % matches.length;
    setFind({ ...find, idx });
    select(matches[idx]);
  };
  const replaceMatches = (all: boolean) => {
    if (!find || !find.q || readOnly) return;
    const targets = all ? matches : matches.slice(find.idx, find.idx + 1);
    const pattern = new RegExp(find.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const changes: Record<string, Partial<Cell>> = {};
    targets.forEach((p) => {
      const key = cellKey(p.c, p.r);
      const cell = sheet.cells[key];
      if (cell && cell.v.search(pattern) >= 0) changes[key] = { v: cell.v.replace(pattern, find.rep) };
    });
    setCells(changes);
    toast.info(`${Object.keys(changes).length}칸을 바꿨습니다.`, { position: 'bottom-center' });
  };

  // ── 키보드
  const onGridKey = (e: React.KeyboardEvent<HTMLElement>) => {
    if (editing || renaming !== null || e.nativeEvent.isComposing) return;
    if (fromOtherInput(e)) return;
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    if (selectedChart && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      updateSheet((s) => ({ ...s, charts: (s.charts || []).filter((ch) => ch.id !== selectedChart) }));
      setSelectedChart(null);
      return;
    }
    const moves: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dc, dr] = moves[e.key];
      select(step(e.shiftKey ? focus : anchor, dc, dr, mod), e.shiftKey);
      return;
    }
    if (e.key === 'PageDown' || e.key === 'PageUp') {
      e.preventDefault();
      const n = Math.max(1, Math.floor(scroll.h / 26) - 2);
      select({ c: anchor.c, r: anchor.r + (e.key === 'PageDown' ? n : -n) }, e.shiftKey);
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      select(mod ? { c: 0, r: 0 } : { c: 0, r: anchor.r }, e.shiftKey);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      const { maxC, maxR } = usedBounds(sheet);
      select(mod ? { c: Math.max(0, maxC), r: Math.max(0, maxR) } : { c: Math.max(0, maxC), r: anchor.r }, e.shiftKey);
      return;
    }
    if (mod && key === 'f') {
      e.preventDefault();
      setFind((f) => f || { q: '', rep: '', idx: 0 });
      return;
    }
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
      setAnchor({ c: 0, r: 0 });
      setFocus({ c: sheet.cols - 1, r: sheet.rows - 1 });
      return;
    }
    if (mod && (key === 'b' || key === 'i' || key === 'u')) {
      e.preventDefault();
      toggle(key as 'b' | 'i' | 'u');
      return;
    }
    if (e.ctrlKey && (key === 'd' || key === 'r')) {
      e.preventDefault();
      fillDir(key === 'd' ? 'down' : 'right');
      return;
    }
    if (e.ctrlKey && e.key === ';') {
      e.preventDefault();
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      setCells({
        [cellKey(anchor.c, anchor.r)]: { v: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` },
      });
      return;
    }
    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      startEdit(anchor, undefined, false, 'edit');
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      select(step(anchor, e.shiftKey ? -1 : 1, 0, false));
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (!readOnly) forRange(sel, (k, cell) => (cell ? { v: '' } : null));
      return;
    }
    if (e.key === 'Escape') {
      setMenu(null);
      setFind(null);
      return;
    }
    // 글자는 입력칸에 그대로 들어가고, onChange 에서 고치기를 시작한다
  };

  // ── 마우스
  const wrapPoint = (e: React.MouseEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    return { x: e.clientX - (rect?.left || 0), y: e.clientY - (rect?.top || 0) };
  };
  const onCellDown = (p: Pos) => (e: React.MouseEvent) => {
    if (e.button === 2) {
      if (!inRange(sel, p.c, p.r)) select(p);
      return;
    }
    if (e.button !== 0) return;
    // 수식을 쓰는 중에 다른 칸을 누르면 그 칸 주소를 넣는다
    if (editing && editing.text.startsWith('=') && (editing.c !== p.c || editing.r !== p.r)) {
      e.preventDefault();
      const input = editing.fromBar ? barRef.current : editRef.current;
      const at = input?.selectionStart ?? editing.text.length;
      const end = input?.selectionEnd ?? at;
      const ref = cellKey(p.c, p.r);
      setEditing({ ...editing, text: editing.text.slice(0, at) + ref + editing.text.slice(end) });
      requestAnimationFrame(() => {
        input?.focus();
        input?.setSelectionRange(at + ref.length, at + ref.length);
      });
      return;
    }
    if (editing) finishEdit();
    e.preventDefault();
    focusGrid();
    dragging.current = 'select';
    select(p, e.shiftKey);
  };
  const onCellEnter = (p: Pos) => () => {
    if (dragging.current === 'select') setFocus(clamp(p));
    if (dragging.current === 'fill') {
      let target = sel;
      if (p.r > sel.r2) target = { ...sel, r2: p.r };
      else if (p.r < sel.r1) target = { ...sel, r1: p.r };
      else if (p.c > sel.c2) target = { ...sel, c2: p.c };
      else if (p.c < sel.c1) target = { ...sel, c1: p.c };
      fillRef.current = target;
      setFillTarget(target);
    }
  };
  useEffect(() => {
    const stop = () => {
      if (dragging.current === 'fill' && fillRef.current) {
        const target = fillRef.current;
        if (target.r1 !== sel.r1 || target.r2 !== sel.r2 || target.c1 !== sel.c1 || target.c2 !== sel.c2) {
          setCells(fillCells(sheet, sel, target));
          setAnchor({ c: target.c1, r: target.r1 });
          setFocus({ c: target.c2, r: target.r2 });
        }
      }
      dragging.current = null;
      fillRef.current = null;
      setFillTarget(null);
    };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  });
  const onContext = (kind: 'cell' | 'row' | 'col') => (e: React.MouseEvent) => {
    e.preventDefault();
    if (editing) finishEdit();
    setMenu({ kind, ...wrapPoint(e) });
  };

  const selectRow = (r: number, extend: boolean) => {
    if (editing) finishEdit();
    setAnchor({ c: 0, r: extend ? anchor.r : r });
    setFocus({ c: sheet.cols - 1, r });
    focusGrid();
  };
  const selectCol = (c: number, extend: boolean) => {
    if (editing) finishEdit();
    setAnchor({ c: extend ? anchor.c : c, r: 0 });
    setFocus({ c, r: sheet.rows - 1 });
    focusGrid();
  };

  // 열 너비·행 높이 끌어서 바꾸기 (고른 여러 줄이면 모두)
  const onResize = (axis: 'col' | 'row', i: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (readOnly) return;
    const start = axis === 'col' ? e.clientX : e.clientY;
    const base = axis === 'col' ? widthOf(sheet, i) : heightOf(sheet, i);
    let size = base;
    const guide = document.createElement('div');
    guide.style.cssText = `position:fixed;z-index:50;background:#1264a3;${
      axis === 'col' ? `top:0;bottom:0;width:1px;left:${e.clientX}px` : `left:0;right:0;height:1px;top:${e.clientY}px`
    }`;
    document.body.appendChild(guide);
    const onMove = (ev: MouseEvent) => {
      const pos = axis === 'col' ? ev.clientX : ev.clientY;
      size = Math.max(axis === 'col' ? 24 : 16, Math.min(axis === 'col' ? 800 : 400, base + pos - start));
      if (axis === 'col') guide.style.left = `${start + size - base}px`;
      else guide.style.top = `${start + size - base}px`;
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      guide.remove();
      if (Math.round(size) === base) return;
      const whole =
        axis === 'col' ? sel.r1 === 0 && sel.r2 === sheet.rows - 1 : sel.c1 === 0 && sel.c2 === sheet.cols - 1;
      const inSel = axis === 'col' ? i >= sel.c1 && i <= sel.c2 : i >= sel.r1 && i <= sel.r2;
      const [a, b] = whole && inSel ? (axis === 'col' ? [sel.c1, sel.c2] : [sel.r1, sel.r2]) : [i, i];
      updateSheet((s) => {
        if (axis === 'col') {
          const widths = { ...s.widths };
          for (let c = a; c <= b; c += 1) widths[colName(c)] = Math.round(size);
          return { ...s, widths };
        }
        const heights = { ...(s.heights || {}) };
        for (let r = a; r <= b; r += 1) heights[String(r + 1)] = Math.round(size);
        return { ...s, heights };
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── 차트
  const chartData = (text: string) => {
    const range = parseRange(text);
    if (!range) return { categories: [], series: [] };
    const rows: (string | number | null)[][] = [];
    for (let r = range.r1; r <= Math.min(range.r2, range.r1 + 200); r += 1) {
      if (hiddenRows.has(r)) continue;
      const row: (string | number | null)[] = [];
      for (let c = range.c1; c <= Math.min(range.c2, range.c1 + 20); c += 1) {
        const v = valueAt(c, r);
        row.push(typeof v === 'number' ? v : v === null || v instanceof FormulaError ? null : String(v));
      }
      rows.push(row);
    }
    return tableToChart(rows);
  };
  const openChartDialog = (chart?: SheetChart) => {
    if (readOnly) return;
    setChartEdit(chart || null);
    setDialog('chart');
  };
  const saveChart = (v: { type: ChartType; range: string; title: string }) => {
    if (chartEdit) {
      updateSheet((s) => ({
        ...s,
        charts: (s.charts || []).map((ch) => (ch.id === chartEdit.id ? { ...ch, ...v } : ch)),
      }));
    } else {
      const range = parseRange(v.range) || sel;
      const chart: SheetChart = {
        id: newId(),
        ...v,
        x: HEADER_W + colX[Math.min(sheet.cols, range.c2 + 1)] + 16,
        y: HEADER_H + rowY[range.r1],
        w: 440,
        h: 270,
      };
      updateSheet((s) => ({ ...s, charts: [...(s.charts || []), chart] }));
      setSelectedChart(chart.id);
    }
    setDialog(null);
  };
  const startChartDrag = (chart: SheetChart, resize: boolean) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedChart(chart.id);
    focusGrid();
    if (readOnly) return;
    const sx = e.clientX;
    const sy = e.clientY;
    let rect = { id: chart.id, x: chart.x, y: chart.y, w: chart.w, h: chart.h };
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      moved = true;
      rect = resize
        ? { ...rect, w: Math.max(180, chart.w + dx), h: Math.max(120, chart.h + dy) }
        : { ...rect, x: Math.max(HEADER_W, chart.x + dx), y: Math.max(HEADER_H, chart.y + dy) };
      setChartDrag(rect);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setChartDrag(null);
      if (moved) {
        updateSheet((s) => ({
          ...s,
          charts: (s.charts || []).map((ch) =>
            ch.id === chart.id
              ? { ...ch, x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) }
              : ch,
          ),
        }));
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // ── CSV
  const exportCsv = () => {
    const { maxC, maxR } = usedBounds(sheet);
    const rows: string[][] = [];
    for (let r = 0; r <= maxR; r += 1) {
      const row: string[] = [];
      for (let c = 0; c <= maxC; c += 1) {
        const cell = sheet.cells[cellKey(c, r)];
        row.push(cell ? display(valueAt(c, r), formatOf(cell), cell.dp) : '');
      }
      rows.push(row);
    }
    const blob = new Blob([`\uFEFF${toCsv(rows)}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || '시트').replace(/[\\/:*?"<>|]/g, '_')}-${sheet.name}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importCsv = (file?: File) => {
    if (!file || readOnly) return;
    if (file.size > 2_000_000) {
      toast.error('2MB 이하의 CSV 파일만 가져올 수 있습니다.', { position: 'bottom-center' });
      return;
    }
    file.text().then((text) => {
      const firstLine = text.split('\n')[0];
      const sep = /\.tsv$/i.test(file.name) || (firstLine.includes('\t') && !firstLine.includes(',')) ? '\t' : ',';
      const cells = parseDelimited(text.replace(/^\uFEFF/, ''), sep, anchor.c, anchor.r);
      let maxR = 0;
      let maxC = 0;
      Object.keys(cells).forEach((k) => {
        const p = parseRef(k);
        if (!p) return;
        maxR = Math.max(maxR, p.r);
        maxC = Math.max(maxC, p.c);
      });
      updateSheet((s) => {
        const next = applyCells(s, Object.fromEntries(Object.entries(cells).map(([k, c]) => [k, { v: c.v }])));
        return {
          ...next,
          rows: Math.min(MAX_ROWS, Math.max(next.rows, maxR + 1)),
          cols: Math.min(MAX_COLS, Math.max(next.cols, maxC + 1)),
        };
      });
      toast.success(`${Object.keys(cells).length}칸을 가져왔습니다.`, { position: 'bottom-center' });
    });
  };

  // ── 시트 탭
  const addSheet = () => {
    if (readOnly) return;
    const names = new Set(book.sheets.map((s) => s.name));
    let n = book.sheets.length + 1;
    while (names.has(`시트${n}`)) n += 1;
    commit({ ...book, sheets: [...book.sheets, emptySheet(`시트${n}`)] });
    setSheetIndex(book.sheets.length);
  };
  const removeSheet = (i: number) => {
    if (readOnly || book.sheets.length <= 1) return;
    if (!window.confirm(`'${book.sheets[i].name}' 시트를 지울까요?`)) return;
    commit({ ...book, sheets: book.sheets.filter((_, j) => j !== i) });
    setSheetIndex(Math.max(0, i - 1));
  };
  const duplicateSheet = (i: number) => {
    const src = book.sheets[i];
    const copy: Sheet = { ...JSON.parse(JSON.stringify(src)), id: newId(), name: `${src.name} 사본`.slice(0, 30) };
    const sheets = [...book.sheets];
    sheets.splice(i + 1, 0, copy);
    commit({ ...book, sheets });
    setSheetIndex(i + 1);
  };
  const moveSheet = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= book.sheets.length) return;
    const sheets = [...book.sheets];
    [sheets[i], sheets[j]] = [sheets[j], sheets[i]];
    commit({ ...book, sheets });
    setSheetIndex(j);
  };
  const renameSheet = (name: string) => {
    const trimmed = name.trim().slice(0, 30);
    setRenaming(null);
    if (!trimmed || trimmed === sheet.name || readOnly) return;
    commit({ ...book, sheets: book.sheets.map((s, i) => (i === index ? { ...s, name: trimmed } : s)) });
  };

  // ── 고른 칸의 합계·평균·개수
  const stats = useMemo(() => {
    let total = 0;
    let count = 0;
    let filled = 0;
    let min = Infinity;
    let max = -Infinity;
    const size = (sel.c2 - sel.c1 + 1) * (sel.r2 - sel.r1 + 1);
    if (size < 2) return null;
    Object.keys(sheet.cells).forEach((key) => {
      const p = parseRef(key);
      if (!p || !inRange(sel, p.c, p.r) || hiddenRows.has(p.r)) return;
      const v = valueAt(p.c, p.r);
      if (v !== null && v !== '') filled += 1;
      if (typeof v === 'number') {
        total += v;
        count += 1;
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    });
    return { total, count, filled, min, max };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.c1, sel.c2, sel.r1, sel.r2, sheet.cells, valueAt, hiddenRows]);

  // ── 칸 그리기
  const findCurrent = find && matches.length ? matches[Math.min(find.idx, matches.length - 1)] : null;
  const isMulti = sel.c1 !== sel.c2 || sel.r1 !== sel.r2;
  const renderCell = (c: number, r: number, x0: number, y0: number, rendered: Set<string>) => {
    let key = cellKey(c, r);
    let cc = c;
    let rr = r;
    let x = x0;
    let y = y0;
    let w = colX[c + 1] - colX[c];
    let h = rowY[r + 1] - rowY[r];
    const m = merges.get(key);
    if (m) {
      cc = m.c1;
      rr = m.r1;
      key = cellKey(cc, rr);
      if (rendered.has(key)) return null;
      x += colX[cc] - colX[c];
      y += rowY[rr] - rowY[r];
      w = colX[m.c2 + 1] - colX[m.c1];
      h = rowY[m.r2 + 1] - rowY[m.r1];
    }
    rendered.add(key);
    if (w <= 0 || h <= 0) return null;
    const cell = sheet.cells[key];
    const value = cell ? valueAt(cc, rr) : null;
    const rs = ruleStyle.get(key);
    const fmt = formatOf(cell);
    const classes = ['cell'];
    if (typeof value === 'number' && fmt !== 'text') classes.push('num');
    if (value instanceof FormulaError) classes.push('err');
    if (cell?.wrap) classes.push('wrap');
    if (isMulti && (m ? overlaps(m, sel) : inRange(sel, cc, rr))) classes.push('in');
    const isCursor = m ? inRange(m, anchor.c, anchor.r) : cc === anchor.c && rr === anchor.r;
    if (isCursor) classes.push('cursor');
    if (findCurrent && findCurrent.c === cc && findCurrent.r === rr) classes.push('found');
    if (fillTarget && inRange(fillTarget, cc, rr) && !inRange(sel, cc, rr)) classes.push('fill-target');
    const isEditing = !!editing && !editing.fromBar && editing.c === cc && editing.r === rr;
    const bd = cell?.border;
    const line = '1px solid #1d1c1d';
    const filterHead = !!filterRange && rr === filterRange.r1 && cc >= filterRange.c1 && cc <= filterRange.c2;
    const filterActive = filterHead && (sheet.filter?.hidden[String(cc)] || []).length > 0;
    const endC = m ? m.c2 : cc;
    const endR = m ? m.r2 : rr;
    const showHandle = !readOnly && !editing && endC === sel.c2 && endR === sel.r2;
    if (showHandle) classes.push('has-handle');
    return (
      <div
        key={key}
        className={classes.join(' ')}
        style={{
          left: x,
          top: y,
          width: w,
          height: h,
          fontWeight: cell?.b || rs?.bold ? 700 : undefined,
          fontStyle: cell?.i ? 'italic' : undefined,
          textDecoration: [cell?.u && 'underline', cell?.s && 'line-through'].filter(Boolean).join(' ') || undefined,
          fontSize: cell?.fs,
          color: rs?.color || cell?.color,
          background: rs?.bg || cell?.bg,
          alignItems: cell?.valign === 'top' ? 'flex-start' : cell?.valign === 'middle' ? 'center' : undefined,
          borderTop: bd?.t ? line : undefined,
          borderLeft: bd?.l ? line : undefined,
          borderRight: bd?.r ? line : undefined,
          borderBottom: bd?.b ? line : undefined,
        }}
        onMouseDown={onCellDown({ c: cc, r: rr })}
        onMouseEnter={onCellEnter({ c, r })}
        onDoubleClick={() => startEdit({ c: cc, r: rr }, undefined, false, 'edit')}
        onContextMenu={onContext('cell')}
        data-cell={key}
        title={cell?.note || undefined}
      >
        <span className="text" style={{ textAlign: cell?.align }}>
          {cell && !isEditing ? display(value, fmt, cell.dp) : ''}
        </span>
        {cell?.list && isCursor && !readOnly && !isEditing && (
          <span
            className="drop"
            role="button"
            aria-label="목록에서 고르기"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startEdit({ c: cc, r: rr }, '');
            }}
          >
            <ChevronDown size={14} />
          </span>
        )}
        {filterHead && (
          <span
            className={`filter-btn${filterActive ? ' active' : ''}`}
            role="button"
            aria-label={`${colName(cc)}열 필터`}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const wrap = wrapRef.current?.getBoundingClientRect();
              setMenu({
                kind: 'filter',
                c: cc,
                x: rect.left - (wrap?.left || 0) - 180,
                y: rect.bottom - (wrap?.top || 0) + 2,
              });
            }}
          >
            <FilterIcon size={11} fill={filterActive ? 'currentColor' : 'none'} />
          </span>
        )}
        {cell?.note && <span className="note" aria-label="메모 있음" />}
        {showHandle && (
          <span
            className="handle"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dragging.current = 'fill';
              fillRef.current = sel;
              setFillTarget(sel);
            }}
            aria-label="채우기 핸들"
          />
        )}
      </div>
    );
  };

  // 보이는 범위 (이분 탐색)
  const firstIndex = (pos: number[], v: number) => {
    let lo = 0;
    let hi = pos.length - 2;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (pos[mid + 1] <= v) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const span = (a: number, b: number) => (b < a ? [] : Array.from({ length: b - a + 1 }, (_, i) => a + i));
  const bodyRows = span(
    Math.max(fr, firstIndex(rowY, scroll.top + frozenH)),
    Math.min(sheet.rows - 1, firstIndex(rowY, scroll.top + scroll.h) + 1),
  );
  const bodyCols = span(
    Math.max(fc, firstIndex(colX, scroll.left + frozenW)),
    Math.min(sheet.cols - 1, firstIndex(colX, scroll.left + scroll.w) + 1),
  );
  const frozenRows = span(0, fr - 1);
  const frozenCols = span(0, fc - 1);

  const pane = (rowsIn: number[], colsIn: number[], ox: number, oy: number) => {
    const rendered = new Set<string>();
    const out: React.ReactNode[] = [];
    rowsIn.forEach((r) => {
      if (hiddenRows.has(r)) return;
      colsIn.forEach((c) => {
        if (colX[c + 1] === colX[c]) return;
        const node = renderCell(c, r, ox + colX[c], oy + rowY[r], rendered);
        if (node) out.push(node);
      });
    });
    return out;
  };

  const colHeader = (c: number, x: number) => {
    if (colX[c + 1] === colX[c]) return null;
    const active = c >= sel.c1 && c <= sel.c2;
    return (
      <div
        key={`ch${c}`}
        className={`hdr${active ? ' active' : ''}`}
        style={{ left: x, top: 0, width: colX[c + 1] - colX[c], height: HEADER_H }}
        onMouseDown={(e) => e.button === 0 && selectCol(c, e.shiftKey)}
        onContextMenu={(e) => {
          if (!active) selectCol(c, false);
          onContext('col')(e);
        }}
      >
        {colName(c)}
        <span className="rz-c" onMouseDown={onResize('col', c)} />
      </div>
    );
  };
  const rowHeader = (r: number, y: number) => {
    if (hiddenRows.has(r)) return null;
    const active = r >= sel.r1 && r <= sel.r2;
    return (
      <div
        key={`rh${r}`}
        className={`hdr${active ? ' active' : ''}`}
        style={{ left: 0, top: y, width: HEADER_W, height: rowY[r + 1] - rowY[r] }}
        onMouseDown={(e) => e.button === 0 && selectRow(r, e.shiftKey)}
        onContextMenu={(e) => {
          if (!active) selectRow(r, false);
          onContext('row')(e);
        }}
      >
        {r + 1}
        <span className="rz-r" onMouseDown={onResize('row', r)} />
      </div>
    );
  };

  const barText = editing ? editing.text : activeCell?.v ?? '';
  const editorPos =
    editing && !editing.fromBar
      ? {
          x: HEADER_W + colX[editing.c] - (editing.c >= fc ? scroll.left : 0),
          y: HEADER_H + rowY[editing.r + 1] - (editing.r >= fr ? scroll.top : 0),
        }
      : null;

  const filterMenu = menu?.kind === 'filter' && filterRange ? menu : null;
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
  const toolButton = (key: string, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        const btn = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const wrap = wrapRef.current?.getBoundingClientRect();
        const want = Math.min(btn.left - (wrap?.left || 0), (wrap?.width || 800) - 250);
        setToolLeft(Math.max(4, want) - (btn.left - (wrap?.left || 0)));
        setToolMenu(toolMenu === key ? null : key);
      }}
      aria-haspopup="menu"
      title={label}
      aria-label={label}
    >
      {icon}
      <ChevronDown size={11} />
    </button>
  );
  const menuItem = (label: React.ReactNode, onClick: () => void, keyHint?: string) => (
    <button
      type="button"
      role="menuitem"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={() => {
        setMenu(null);
        setToolMenu(null);
        onClick();
      }}
    >
      {label}
      {keyHint && <span className="key">{keyHint}</span>}
    </button>
  );
  const wrapW = wrapRef.current?.clientWidth || 800;
  const wrapH = wrapRef.current?.clientHeight || 600;

  return (
    <SheetWrap ref={wrapRef}>
      {!readOnly && (
        <SheetToolbar role="toolbar" aria-label="스프레드시트 도구">
          {tb('되돌리기 (⌘Z)', <Undo2 {...ICON} />, undo, false, !undoStack.current.length)}
          {tb('다시 하기 (⇧⌘Z)', <Redo2 {...ICON} />, redo, false, !redoStack.current.length)}
          <span className="sep" />
          <select
            value={activeCell?.fmt || 'general'}
            onChange={(e) => setFormat(e.target.value as NumberFormat)}
            aria-label="숫자 형식"
          >
            {FORMATS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
          {tb('소수 자릿수 줄이기', <span style={{ fontSize: 11 }}>.0←</span>, () => changeDecimals(-1))}
          {tb('소수 자릿수 늘리기', <span style={{ fontSize: 11 }}>.00→</span>, () => changeDecimals(1))}
          <span className="sep" />
          <select
            value={activeCell?.fs || 13}
            onChange={(e) =>
              forRange(sel, () => ({ fs: Number(e.target.value) === 13 ? undefined : Number(e.target.value) }))
            }
            aria-label="글자 크기"
          >
            {Array.from(new Set([...FONT_SIZES, 13]))
              .sort((a, b) => a - b)
              .map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
          </select>
          {tb('굵게 (⌘B)', <Bold {...ICON} />, () => toggle('b'), !!activeCell?.b)}
          {tb('기울임 (⌘I)', <Italic {...ICON} />, () => toggle('i'), !!activeCell?.i)}
          {tb('밑줄 (⌘U)', <Underline {...ICON} />, () => toggle('u'), !!activeCell?.u)}
          {tb('취소선', <Strikethrough {...ICON} />, () => toggle('s'), !!activeCell?.s)}
          <label className="tool" title="글자색">
            <Type {...ICON} />
            <span className="swatch" style={{ background: activeCell?.color || 'var(--text)' }} />
            <input
              type="color"
              aria-label="글자색"
              value={activeCell?.color || '#1d1c1d'}
              onChange={(e) => setColor('color', e.target.value)}
            />
          </label>
          <label className="tool" title="채우기 색">
            <PaintBucket {...ICON} />
            <span className="swatch" style={{ background: activeCell?.bg || 'transparent' }} />
            <input
              type="color"
              aria-label="채우기 색"
              value={activeCell?.bg || '#ffffff'}
              onChange={(e) => setColor('bg', e.target.value)}
            />
          </label>
          <span className="group">
            {toolButton('border', '테두리', <Grid2x2 {...ICON} />)}
            {toolMenu === 'border' && (
              <PopMenu style={{ top: 32, left: toolLeft }} role="menu">
                {menuItem(
                  <>
                    <Grid2x2 {...ICON} /> 모든 테두리
                  </>,
                  () => setBorders('all'),
                )}
                {menuItem(
                  <>
                    <SquareDashed {...ICON} /> 바깥쪽 테두리
                  </>,
                  () => setBorders('outer'),
                )}
                {menuItem('아래쪽 테두리', () => setBorders('bottom'))}
                {menuItem(
                  <>
                    <X {...ICON} /> 테두리 없음
                  </>,
                  () => setBorders('none'),
                )}
              </PopMenu>
            )}
          </span>
          {tb(mergeAtAnchor ? '병합 해제' : '셀 병합', <Merge {...ICON} />, toggleMerge, !!mergeAtAnchor)}
          <span className="sep" />
          {tb('왼쪽 맞춤', <AlignLeft {...ICON} />, () => setAlign('left'), activeCell?.align === 'left')}
          {tb('가운데 맞춤', <AlignCenter {...ICON} />, () => setAlign('center'), activeCell?.align === 'center')}
          {tb('오른쪽 맞춤', <AlignRight {...ICON} />, () => setAlign('right'), activeCell?.align === 'right')}
          {tb(
            '위쪽 맞춤',
            <AlignVerticalJustifyStart {...ICON} />,
            () => setVAlign('top'),
            activeCell?.valign === 'top',
          )}
          {tb(
            '세로 가운데 맞춤',
            <AlignVerticalJustifyCenter {...ICON} />,
            () => setVAlign('middle'),
            activeCell?.valign === 'middle',
          )}
          {tb('아래쪽 맞춤', <AlignVerticalJustifyEnd {...ICON} />, () => setVAlign('bottom'), !activeCell?.valign)}
          {tb('줄 바꿈', <WrapText {...ICON} />, () => toggle('wrap'), !!activeCell?.wrap)}
          {tb('서식 지우기', <Eraser {...ICON} />, clearFormats)}
          <span className="sep" />
          <span className="group">
            {toolButton('sum', '자동 합계', <Sigma {...ICON} />)}
            {toolMenu === 'sum' && (
              <PopMenu style={{ top: 32, left: toolLeft }} role="menu">
                {menuItem('합계 (SUM)', () => autoFn('SUM'))}
                {menuItem('평균 (AVERAGE)', () => autoFn('AVERAGE'))}
                {menuItem('개수 (COUNT)', () => autoFn('COUNT'))}
                {menuItem('최댓값 (MAX)', () => autoFn('MAX'))}
                {menuItem('최솟값 (MIN)', () => autoFn('MIN'))}
              </PopMenu>
            )}
          </span>
          {tb('오름차순 정렬', <ArrowDownAZ {...ICON} />, () => sortBy(false))}
          {tb('내림차순 정렬', <ArrowUpAZ {...ICON} />, () => sortBy(true))}
          {tb(sheet.filter ? '필터 끄기' : '필터', <FilterIcon {...ICON} />, toggleFilter, !!sheet.filter)}
          <span className="group">
            {toolButton('freeze', '틀 고정', <Snowflake {...ICON} />)}
            {toolMenu === 'freeze' && (
              <PopMenu style={{ top: 32, left: toolLeft }} role="menu">
                {menuItem('첫 행 고정', () => setFreeze(1, fc))}
                {menuItem('첫 열 고정', () => setFreeze(fr, 1))}
                {menuItem(`${cellKey(anchor.c, anchor.r)} 위·왼쪽까지 고정`, () => setFreeze(anchor.r, anchor.c))}
                {menuItem('고정 해제', () => setFreeze(0, 0))}
              </PopMenu>
            )}
          </span>
          {tb('조건부 서식', <Highlighter {...ICON} />, () => setDialog('cond'))}
          {tb('드롭다운 목록 (데이터 확인)', <ListChecks {...ICON} />, () => setDialog('valid'))}
          {tb('차트 넣기', <BarChart3 {...ICON} />, () => openChartDialog())}
          {tb('메모', <MessageSquareText {...ICON} />, () => setDialog('note'), !!activeCell?.note)}
          {tb(
            '찾기·바꾸기 (⌘F)',
            <Search {...ICON} />,
            () => setFind((f) => (f ? null : { q: '', rep: '', idx: 0 })),
            !!find,
          )}
          <span className="group">
            {toolButton('lines', '행·열 넣기·지우기', <Plus {...ICON} />)}
            {toolMenu === 'lines' && (
              <PopMenu style={{ top: 32, left: toolLeft }} role="menu">
                {menuItem('위에 행 넣기', () => lines('row', 'before'))}
                {menuItem('아래에 행 넣기', () => lines('row', 'after'))}
                {menuItem('왼쪽에 열 넣기', () => lines('col', 'before'))}
                {menuItem('오른쪽에 열 넣기', () => lines('col', 'after'))}
                <hr />
                {menuItem('행 지우기', () => lines('row', 'delete'))}
                {menuItem('열 지우기', () => lines('col', 'delete'))}
              </PopMenu>
            )}
          </span>
          <span className="group">
            {toolButton('file', 'CSV 가져오기·내보내기', <Download {...ICON} />)}
            {toolMenu === 'file' && (
              <PopMenu style={{ top: 32, left: toolLeft }} role="menu">
                {menuItem(
                  <>
                    <Download {...ICON} /> CSV 로 내려받기
                  </>,
                  exportCsv,
                )}
                {menuItem(
                  <>
                    <FileUp {...ICON} /> CSV 가져오기 (고른 칸부터)
                  </>,
                  () => fileRef.current?.click(),
                )}
              </PopMenu>
            )}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            style={{ display: 'none' }}
            aria-label="CSV 파일 고르기"
            onChange={(e) => {
              importCsv(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </SheetToolbar>
      )}
      {find && (
        <FindBar role="search">
          <Search size={14} />
          <input
            type="text"
            autoFocus
            value={find.q}
            onChange={(e) => setFind({ ...find, q: e.target.value, idx: 0 })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') goMatch(e.shiftKey ? -1 : 1);
              if (e.key === 'Escape') {
                setFind(null);
                focusGrid();
              }
            }}
            placeholder="찾을 글자"
            aria-label="찾을 글자"
          />
          <span className="count">
            {find.q ? `${matches.length ? Math.min(find.idx, matches.length - 1) + 1 : 0} / ${matches.length}` : ''}
          </span>
          <button type="button" onClick={() => goMatch(-1)} aria-label="이전 찾기">
            ↑
          </button>
          <button type="button" onClick={() => goMatch(1)} aria-label="다음 찾기">
            ↓
          </button>
          {!readOnly && (
            <>
              <input
                type="text"
                value={find.rep}
                onChange={(e) => setFind({ ...find, rep: e.target.value })}
                placeholder="바꿀 글자"
                aria-label="바꿀 글자"
              />
              <button type="button" onClick={() => replaceMatches(false)} disabled={!matches.length}>
                바꾸기
              </button>
              <button type="button" onClick={() => replaceMatches(true)} disabled={!matches.length}>
                모두 바꾸기
              </button>
            </>
          )}
          <button type="button" onClick={() => setFind(null)} aria-label="찾기 닫기" style={{ marginLeft: 'auto' }}>
            <X size={13} />
          </button>
        </FindBar>
      )}
      <FormulaBar>
        <input
          className="name"
          defaultValue={rangeName(sel)}
          key={rangeName(sel)}
          aria-label="이름 상자 (칸 주소로 이동)"
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            const r = parseRange((e.target as HTMLInputElement).value.trim().toUpperCase());
            if (r) {
              setAnchor({ c: Math.min(r.c1, sheet.cols - 1), r: Math.min(r.r1, sheet.rows - 1) });
              setFocus({ c: Math.min(r.c2, sheet.cols - 1), r: Math.min(r.r2, sheet.rows - 1) });
              focusGrid();
            }
          }}
        />
        <span className="fx">fx</span>
        <input
          id="sheet-formula"
          className="formula"
          ref={barRef}
          value={barText}
          readOnly={readOnly}
          aria-label="칸 내용 (수식은 = 로 시작)"
          onFocus={() => {
            if (!readOnly && !editing) startEdit(anchor, undefined, true);
          }}
          onChange={(e) => editing && setEditing({ ...editing, text: e.target.value })}
          onKeyDown={onEditKey}
          onBlur={() => editing?.fromBar && finishEdit()}
        />
      </FormulaBar>
      <Viewport
        ref={viewRef}
        tabIndex={-1}
        onCopy={onCopy}
        onCut={onCut}
        onPaste={onPaste}
        onWheel={onWheel}
        role="grid"
        aria-label={`${sheet.name} 시트`}
        aria-readonly={readOnly}
      >
        <div className="scroller" ref={scrollerRef}>
          <div style={{ position: 'relative', width: HEADER_W + totalW + 200, height: HEADER_H + totalH + 120 }}>
            {pane(bodyRows, bodyCols, HEADER_W, HEADER_H)}
            {(sheet.charts || []).map((chart) => {
              const rect = chartDrag?.id === chart.id ? chartDrag : chart;
              return (
                <div
                  key={chart.id}
                  className={`chart${selectedChart === chart.id ? ' selected' : ''}`}
                  style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
                  onPointerDown={startChartDrag(chart, false)}
                  onDoubleClick={() => openChartDialog(chart)}
                  data-chart={chart.id}
                  title={readOnly ? undefined : '두 번 누르면 차트 고치기'}
                >
                  <Chart
                    type={chart.type}
                    data={chartData(chart.range)}
                    title={chart.title}
                    width={rect.w - 2}
                    height={rect.h - 2}
                    color="var(--text)"
                  />
                  {selectedChart === chart.id && !readOnly && (
                    <span className="chart-rz" onPointerDown={startChartDrag(chart, true)} />
                  )}
                </div>
              );
            })}
            {!readOnly && sheet.rows < MAX_ROWS && (
              <button
                type="button"
                onClick={() => updateSheet((s) => ({ ...s, rows: Math.min(MAX_ROWS, s.rows + 100) }))}
                style={{
                  position: 'absolute',
                  left: HEADER_W + 6,
                  top: HEADER_H + totalH + 10,
                  padding: '4px 10px',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                행 100개 더 넣기
              </button>
            )}
          </div>
        </div>
        {fr > 0 && (
          <div
            className="pane frozen-r"
            style={{ left: HEADER_W, top: HEADER_H, width: scroll.w - HEADER_W, height: frozenH }}
          >
            {pane(frozenRows, bodyCols, -scroll.left, 0)}
          </div>
        )}
        {fc > 0 && (
          <div
            className="pane frozen-c"
            style={{ left: HEADER_W, top: HEADER_H, width: frozenW, height: scroll.h - HEADER_H }}
          >
            {pane(bodyRows, frozenCols, 0, -scroll.top)}
          </div>
        )}
        {fr > 0 && fc > 0 && (
          <div
            className="pane frozen-r frozen-c"
            style={{ left: HEADER_W, top: HEADER_H, width: frozenW, height: frozenH }}
          >
            {pane(frozenRows, frozenCols, 0, 0)}
          </div>
        )}
        <div className="pane" style={{ left: 0, top: 0, width: scroll.w, height: HEADER_H }}>
          {bodyCols.map((c) => colHeader(c, HEADER_W + colX[c] - scroll.left))}
          {frozenCols.map((c) => colHeader(c, HEADER_W + colX[c]))}
          <div
            className="hdr"
            style={{ left: 0, top: 0, width: HEADER_W, height: HEADER_H }}
            onMouseDown={() => {
              setAnchor({ c: 0, r: 0 });
              setFocus({ c: sheet.cols - 1, r: sheet.rows - 1 });
            }}
            role="button"
            aria-label="전체 고르기"
          />
        </div>
        <div className="pane" style={{ left: 0, top: HEADER_H, width: HEADER_W, height: scroll.h - HEADER_H }}>
          {bodyRows.map((r) => rowHeader(r, rowY[r] - scroll.top))}
          {frozenRows.map((r) => rowHeader(r, rowY[r]))}
        </div>
        {(() => {
          const target = editing && !editing.fromBar ? editing : anchor;
          const m = merges.get(cellKey(target.c, target.r));
          const c1 = m ? m.c1 : target.c;
          const r1 = m ? m.r1 : target.r;
          const c2 = m ? m.c2 : target.c;
          const r2 = m ? m.r2 : target.r;
          const cell = sheet.cells[cellKey(c1, r1)];
          const active = !!editing && !editing.fromBar;
          return (
            <input
              ref={editRef}
              className={`cell-input${active ? ' on' : ''}`}
              value={active && editing ? editing.text : ''}
              readOnly={readOnly}
              onChange={(e) => {
                if (readOnly) return;
                if (editing && !editing.fromBar) setEditing({ ...editing, text: e.target.value });
                else startEdit(anchor, e.target.value, false, 'enter');
                setSuggestIndex(0);
              }}
              onCompositionStart={() => {
                if (!editing && !readOnly) startEdit(anchor, '', false, 'enter');
              }}
              onKeyDown={(e) => (editing && !editing.fromBar ? onEditKey(e) : onGridKey(e))}
              onBlur={() => editing && !editing.fromBar && finishEdit()}
              style={{
                left: HEADER_W + colX[c1] - (c1 >= fc ? scroll.left : 0),
                top: HEADER_H + rowY[r1] - (r1 >= fr ? scroll.top : 0),
                width: Math.max(colX[c2 + 1] - colX[c1], active ? 120 : 0),
                height: rowY[r2 + 1] - rowY[r1],
                fontWeight: cell?.b ? 700 : undefined,
                fontSize: cell?.fs,
              }}
              aria-label={active ? `${cellKey(c1, r1)} 고치기` : `${cellKey(c1, r1)} 칸 (글자를 치면 입력)`}
              autoComplete="off"
              spellCheck={false}
            />
          );
        })()}
        {editorPos && suggestions.length > 0 && (
          <div className="suggest" style={{ left: editorPos.x, top: editorPos.y + 2 }} role="listbox" aria-label="추천">
            {suggestions.map((s, i) => (
              <div
                key={s}
                className={i === suggestIndex ? 'on' : undefined}
                role="option"
                aria-selected={i === suggestIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  acceptSuggestion(s);
                }}
              >
                {s}
              </div>
            ))}
          </div>
        )}
      </Viewport>
      <StatusBar>
        <div className="tabs" role="tablist" aria-label="시트">
          {book.sheets.map((s, i) => (
            <span
              key={s.id}
              role="tab"
              tabIndex={0}
              aria-selected={i === index}
              className={`tab${i === index ? ' active' : ''}`}
              style={{ borderBottomColor: s.color || undefined }}
              onClick={() => setSheetIndex(i)}
              onKeyDown={(e) => e.key === 'Enter' && setSheetIndex(i)}
              onDoubleClick={() => !readOnly && setRenaming(s.name)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (readOnly) return;
                setSheetIndex(i);
                const p = wrapPoint(e);
                setMenu({ kind: 'tab', index: i, x: p.x, y: p.y - 240 });
              }}
              title={readOnly ? s.name : '두 번 누르면 이름 바꾸기 · 오른쪽 클릭으로 메뉴'}
            >
              {renaming !== null && i === index ? (
                <input
                  autoFocus
                  defaultValue={renaming}
                  aria-label="시트 이름"
                  onBlur={(e) => renameSheet(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') renameSheet((e.target as HTMLInputElement).value);
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                />
              ) : (
                s.name
              )}
            </span>
          ))}
          {!readOnly && (
            <button type="button" className="add" onClick={addSheet} title="시트 추가" aria-label="시트 추가">
              <Plus size={14} />
            </button>
          )}
        </div>
        {stats && (
          <span className="stats" aria-live="polite">
            {stats.count > 0
              ? `합계 ${display(stats.total, 'number')} · 평균 ${display(
                  stats.total / stats.count,
                  'number',
                )} · 최소 ${display(stats.min, 'number')} · 최대 ${display(stats.max, 'number')} · 개수 ${stats.filled}`
              : `개수 ${stats.filled}`}
          </span>
        )}
      </StatusBar>

      {menu && menu.kind !== 'filter' && (
        <PopMenu
          style={{ left: Math.max(4, Math.min(menu.x, wrapW - 230)), top: Math.max(4, Math.min(menu.y, wrapH - 440)) }}
          role="menu"
          aria-label="메뉴"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {menu.kind === 'tab' ? (
            <>
              {menuItem('이름 바꾸기', () => setRenaming(book.sheets[menu.index].name))}
              {menuItem(
                <>
                  <Copy {...ICON} /> 시트 복제
                </>,
                () => duplicateSheet(menu.index),
              )}
              {menuItem('왼쪽으로 옮기기', () => moveSheet(menu.index, -1))}
              {menuItem('오른쪽으로 옮기기', () => moveSheet(menu.index, 1))}
              <div className="title">탭 색</div>
              <div style={{ display: 'flex', gap: 4, padding: '2px 12px 6px' }}>
                {['', '#e0405a', '#e8891d', '#f2c94c', '#12a06b', '#2f80ed', '#7c5cd6'].map((col) => (
                  <span
                    key={col || 'none'}
                    role="button"
                    aria-label={col ? `탭 색 ${col}` : '탭 색 없음'}
                    onClick={() => {
                      commit({
                        ...book,
                        sheets: book.sheets.map((s, i) => (i === menu.index ? { ...s, color: col || undefined } : s)),
                      });
                      setMenu(null);
                    }}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      background: col || 'var(--bg)',
                      border: '1px solid var(--border-strong)',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
              {book.sheets.length > 1 && <hr />}
              {book.sheets.length > 1 &&
                menuItem(
                  <>
                    <Trash2 {...ICON} /> 시트 지우기
                  </>,
                  () => removeSheet(menu.index),
                )}
            </>
          ) : (
            <>
              {!readOnly &&
                menuItem(
                  <>
                    <Scissors {...ICON} /> 잘라내기
                  </>,
                  () => copySel(true),
                  '⌘X',
                )}
              {menuItem(
                <>
                  <Copy {...ICON} /> 복사
                </>,
                () => {
                  const text = copySel(false);
                  navigator.clipboard?.writeText(text).catch(() => undefined);
                },
                '⌘C',
              )}
              {!readOnly &&
                menuItem(
                  <>
                    <ClipboardPaste {...ICON} /> 붙여넣기
                  </>,
                  menuPaste,
                  '⌘V',
                )}
              {!readOnly && (
                <>
                  <hr />
                  {menu.kind !== 'col' && menuItem('위에 행 넣기', () => lines('row', 'before'))}
                  {menu.kind !== 'col' && menuItem('아래에 행 넣기', () => lines('row', 'after'))}
                  {menu.kind !== 'row' && menuItem('왼쪽에 열 넣기', () => lines('col', 'before'))}
                  {menu.kind !== 'row' && menuItem('오른쪽에 열 넣기', () => lines('col', 'after'))}
                  {menu.kind !== 'col' && menuItem('행 지우기', () => lines('row', 'delete'))}
                  {menu.kind !== 'row' && menuItem('열 지우기', () => lines('col', 'delete'))}
                  {menu.kind === 'row' && (
                    <>
                      <hr />
                      {menuItem('행 숨기기', () => hideLines('row', true))}
                      {menuItem('행 숨기기 취소', () => hideLines('row', false))}
                      {menuItem('행 높이 기본값', () => resetSize('row'))}
                    </>
                  )}
                  {menu.kind === 'col' && (
                    <>
                      <hr />
                      {menuItem('열 숨기기', () => hideLines('col', true))}
                      {menuItem('열 숨기기 취소', () => hideLines('col', false))}
                      {menuItem('열 너비 기본값', () => resetSize('col'))}
                    </>
                  )}
                  {menu.kind === 'cell' && (
                    <>
                      <hr />
                      {menuItem(
                        <>
                          <ArrowDownAZ {...ICON} /> 오름차순 정렬
                        </>,
                        () => sortBy(false),
                      )}
                      {menuItem(
                        <>
                          <ArrowUpAZ {...ICON} /> 내림차순 정렬
                        </>,
                        () => sortBy(true),
                      )}
                      {menuItem(
                        <>
                          <Merge {...ICON} /> {mergeAtAnchor ? '병합 해제' : '셀 병합'}
                        </>,
                        toggleMerge,
                      )}
                      {menuItem(
                        <>
                          <MessageSquareText {...ICON} /> {activeCell?.note ? '메모 고치기' : '메모 넣기'}
                        </>,
                        () => setDialog('note'),
                      )}
                      {menuItem(
                        <>
                          <ListChecks {...ICON} /> 드롭다운 목록
                        </>,
                        () => setDialog('valid'),
                      )}
                      {menuItem(
                        <>
                          <Highlighter {...ICON} /> 조건부 서식
                        </>,
                        () => setDialog('cond'),
                      )}
                      {menuItem(
                        <>
                          <BarChart3 {...ICON} /> 차트 넣기
                        </>,
                        () => openChartDialog(),
                      )}
                      <hr />
                      {menuItem('내용 지우기', () => forRange(sel, (k, cell) => (cell ? { v: '' } : null)), 'Delete')}
                      {menuItem(
                        <>
                          <Eraser {...ICON} /> 서식 지우기
                        </>,
                        clearFormats,
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </PopMenu>
      )}
      {filterMenu && filterRange && (
        <FilterMenu
          x={Math.max(4, filterMenu.x)}
          y={filterMenu.y}
          values={columnValues(sheet, filterRange, filterMenu.c, valueAt)}
          hidden={sheet.filter?.hidden[String(filterMenu.c)] || []}
          onClose={() => setMenu(null)}
          onSort={(desc) => {
            setMenu(null);
            sortBy(desc, filterMenu.c, filterRange, true);
          }}
          onApply={(hidden) => {
            setMenu(null);
            updateSheet((s) =>
              s.filter
                ? { ...s, filter: { ...s.filter, hidden: { ...s.filter.hidden, [String(filterMenu.c)]: hidden } } }
                : s,
            );
          }}
        />
      )}
      <ConditionalDialog
        show={dialog === 'cond'}
        range={rangeName(sel)}
        rules={sheet.rules || []}
        onClose={() => setDialog(null)}
        onChange={(rules) => updateSheet((s) => ({ ...s, rules }))}
      />
      <ValidationDialog
        show={dialog === 'valid'}
        range={rangeName(sel)}
        initial={activeCell?.list || []}
        onClose={() => setDialog(null)}
        onSave={(items) => {
          forRange(sel, () => ({ list: items || undefined }));
          setDialog(null);
        }}
      />
      <NoteDialog
        show={dialog === 'note'}
        cell={cellKey(anchor.c, anchor.r)}
        initial={activeCell?.note || ''}
        onClose={() => setDialog(null)}
        onSave={(note) => {
          setCells({ [cellKey(anchor.c, anchor.r)]: { note: note || undefined } });
          setDialog(null);
        }}
      />
      <ChartDialog
        show={dialog === 'chart'}
        editing={!!chartEdit}
        initial={
          chartEdit || { type: 'column', range: rangeName(isMulti ? sel : currentRegion(sheet, anchor.c, anchor.r)) }
        }
        onClose={() => setDialog(null)}
        onSave={saveChart}
        onDelete={() => {
          if (chartEdit)
            updateSheet((s) => ({ ...s, charts: (s.charts || []).filter((ch) => ch.id !== chartEdit.id) }));
          setDialog(null);
        }}
      />
    </SheetWrap>
  );
};

export default SheetEditor;
