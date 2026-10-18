import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Columns3,
  Italic,
  PaintBucket,
  Plus,
  Redo2,
  Rows3,
  Sigma,
  Trash2,
  Type,
  Undo2,
  X,
} from 'lucide-react';
import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cellKey, colName, createEvaluator, FormulaError } from './formula';
import {
  Align,
  Cell,
  display,
  emptySheet,
  insertLines,
  MAX_COLS,
  MAX_ROWS,
  moveFormula,
  norm,
  NumberFormat,
  parseWorkbook,
  Range,
  rangeName,
  ROW_HEIGHT,
  Sheet,
  stringifyWorkbook,
  widthOf,
  Workbook,
} from './model';
import { FormulaBar, Grid, SheetToolbar, SheetWrap, StatusBar } from './styles';

interface Props {
  value: string;
  readOnly: boolean;
  onChange: (next: string) => void;
}

interface Pos {
  c: number;
  r: number;
}

interface Editing extends Pos {
  text: string;
  fromBar: boolean;
}

const ICON = { size: 15, strokeWidth: 2 };
const HEADER_W = 46;
const FORMATS: [NumberFormat, string][] = [
  ['general', '자동'],
  ['number', '숫자 1,234'],
  ['percent', '퍼센트 %'],
  ['currency', '원화 ₩'],
];

// 엑셀처럼 칸을 고르고 고치는 스프레드시트. 고친 내용은 통합 문서 JSON 으로 onChange 에 넘긴다
const SheetEditor: FC<Props> = ({ value, readOnly, onChange }) => {
  const book = useMemo(() => parseWorkbook(value), [value]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const index = Math.min(sheetIndex, book.sheets.length - 1);
  const sheet = book.sheets[index];
  const [anchor, setAnchor] = useState<Pos>({ c: 0, r: 0 });
  const [focus, setFocus] = useState<Pos>({ c: 0, r: 0 });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const valueRef = useRef(value);
  valueRef.current = value;
  const dragging = useRef(false);
  const clipboard = useRef<{ text: string; origin: Pos; cells: (Cell | undefined)[][] } | null>(null);
  const [scroll, setScroll] = useState({ top: 0, height: 600 });
  const sel = norm(anchor, focus);

  const evaluator = useMemo(() => createEvaluator((key) => sheet.cells[key]?.v), [sheet]);

  // ── 바꾸기 (되돌리기 기록과 함께)
  const commit = useCallback(
    (next: Workbook) => {
      const text = stringifyWorkbook(next);
      if (text === valueRef.current) return;
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
  const setCells = (changes: Record<string, Partial<Cell> | null>) =>
    updateSheet((s) => {
      const cells = { ...s.cells };
      Object.entries(changes).forEach(([key, change]) => {
        if (change === null) {
          delete cells[key];
          return;
        }
        const merged = { ...{ v: '' }, ...cells[key], ...change } as Cell;
        // 내용도 꾸밈도 없으면 지운다
        if (!merged.v && !merged.b && !merged.i && !merged.align && !merged.color && !merged.bg && !merged.fmt) {
          delete cells[key];
        } else {
          cells[key] = merged;
        }
      });
      return { ...s, cells };
    });
  const forRange = (range: Range, fn: (key: string) => Partial<Cell> | null) => {
    const changes: Record<string, Partial<Cell> | null> = {};
    for (let r = range.r1; r <= range.r2; r += 1) {
      for (let c = range.c1; c <= range.c2; c += 1) {
        changes[cellKey(c, r)] = fn(cellKey(c, r));
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

  // ── 고르기·움직이기
  const clamp = (p: Pos): Pos => ({
    c: Math.max(0, Math.min(sheet.cols - 1, p.c)),
    r: Math.max(0, Math.min(sheet.rows - 1, p.r)),
  });
  const select = (p: Pos, extend = false) => {
    const next = clamp(p);
    if (!extend) setAnchor(next);
    setFocus(next);
  };
  // 고른 칸이 보이게 스크롤
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const top = focus.r * ROW_HEIGHT;
    const headH = ROW_HEIGHT;
    if (top < grid.scrollTop) grid.scrollTop = top;
    else if (top + ROW_HEIGHT > grid.scrollTop + grid.clientHeight - headH) {
      grid.scrollTop = top + ROW_HEIGHT - grid.clientHeight + headH;
    }
    let left = 0;
    for (let c = 0; c < focus.c; c += 1) left += widthOf(sheet, c);
    const w = widthOf(sheet, focus.c);
    if (left < grid.scrollLeft) grid.scrollLeft = left;
    else if (left + w > grid.scrollLeft + grid.clientWidth - HEADER_W) {
      grid.scrollLeft = left + w - grid.clientWidth + HEADER_W;
    }
  }, [focus, sheet]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return undefined;
    const update = () => setScroll({ top: grid.scrollTop, height: grid.clientHeight });
    update();
    grid.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      grid.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    const stop = () => {
      dragging.current = false;
    };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  // 시트를 바꾸면 처음 칸으로
  useEffect(() => {
    setAnchor({ c: 0, r: 0 });
    setFocus({ c: 0, r: 0 });
    setEditing(null);
  }, [index]);

  // ── 고치기
  const startEdit = (p: Pos, text?: string, fromBar = false) => {
    if (readOnly) return;
    setEditing({ ...p, text: text ?? sheet.cells[cellKey(p.c, p.r)]?.v ?? '', fromBar });
  };
  useEffect(() => {
    if (editing && !editing.fromBar) {
      editRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.c, editing?.r, editing?.fromBar]);

  const finishEdit = (move?: Pos) => {
    if (editing) {
      const key = cellKey(editing.c, editing.r);
      if ((sheet.cells[key]?.v ?? '') !== editing.text) {
        setCells({ [key]: { v: editing.text } });
      }
      setEditing(null);
      if (move) select({ c: editing.c + move.c, r: editing.r + move.r });
    }
    gridRef.current?.focus();
  };
  const cancelEdit = () => {
    setEditing(null);
    gridRef.current?.focus();
  };

  const onEditKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
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

  const onGridKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (editing || renaming !== null) return;
    const mod = e.metaKey || e.ctrlKey;
    const moves: Record<string, Pos> = {
      ArrowUp: { c: 0, r: -1 },
      ArrowDown: { c: 0, r: 1 },
      ArrowLeft: { c: -1, r: 0 },
      ArrowRight: { c: 1, r: 0 },
    };
    if (moves[e.key]) {
      e.preventDefault();
      const d = moves[e.key];
      const from = e.shiftKey ? focus : anchor;
      // Cmd+방향키: 끝까지
      const step = mod ? 10000 : 1;
      select({ c: from.c + d.c * step, r: from.r + d.r * step }, e.shiftKey);
      return;
    }
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
    if (mod && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      setAnchor({ c: 0, r: 0 });
      setFocus({ c: sheet.cols - 1, r: sheet.rows - 1 });
      return;
    }
    if (mod && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      toggleStyle('b');
      return;
    }
    if (mod && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      toggleStyle('i');
      return;
    }
    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      startEdit(anchor);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      select({ c: anchor.c + (e.shiftKey ? -1 : 1), r: anchor.r });
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (!readOnly) forRange(sel, (key) => (sheet.cells[key] ? { v: '' } : null));
      return;
    }
    // 글자를 치면 바로 그 칸에 새로 쓴다
    if (!mod && !e.altKey && e.key.length === 1) {
      e.preventDefault();
      startEdit(anchor, e.key);
    }
  };

  // ── 마우스
  const onCellDown = (p: Pos) => (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // 수식을 쓰는 중에 다른 칸을 누르면 그 칸 주소를 넣는다
    if (editing && editing.text.startsWith('=') && (editing.c !== p.c || editing.r !== p.r)) {
      e.preventDefault();
      const input = editing.fromBar ? (document.getElementById('sheet-formula') as HTMLInputElement) : editRef.current;
      const at = input?.selectionStart ?? editing.text.length;
      const ref = cellKey(p.c, p.r);
      const text = editing.text.slice(0, at) + ref + editing.text.slice(input?.selectionEnd ?? at);
      setEditing({ ...editing, text });
      requestAnimationFrame(() => {
        input?.focus();
        input?.setSelectionRange(at + ref.length, at + ref.length);
      });
      return;
    }
    if (editing) finishEdit();
    e.preventDefault();
    gridRef.current?.focus();
    dragging.current = true;
    select(p, e.shiftKey);
  };
  const onCellEnter = (p: Pos) => () => {
    if (dragging.current) setFocus(clamp(p));
  };
  const selectRow = (r: number, extend: boolean) => {
    if (editing) finishEdit();
    if (!extend) setAnchor({ c: 0, r });
    else setAnchor({ c: 0, r: anchor.r });
    setFocus({ c: sheet.cols - 1, r });
    gridRef.current?.focus();
  };
  const selectCol = (c: number, extend: boolean) => {
    if (editing) finishEdit();
    if (!extend) setAnchor({ c, r: 0 });
    else setAnchor({ c: anchor.c, r: 0 });
    setFocus({ c, r: sheet.rows - 1 });
    gridRef.current?.focus();
  };

  // 열 너비 끌어서 바꾸기
  const onResizeDown = (c: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (readOnly) return;
    const startX = e.clientX;
    const startW = widthOf(sheet, c);
    let width = startW;
    const th = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
    const col = gridRef.current?.querySelector<HTMLElement>(`col[data-c="${c}"]`);
    const onMove = (ev: MouseEvent) => {
      width = Math.max(40, Math.min(600, startW + ev.clientX - startX));
      if (col) col.style.width = `${width}px`;
      th.style.width = `${width}px`;
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (width !== startW) {
        updateSheet((s) => ({ ...s, widths: { ...s.widths, [colName(c)]: Math.round(width) } }));
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── 복사·붙여넣기 (다른 프로그램과는 탭으로 나눈 글로)
  const rangeText = (range: Range) => {
    const lines: string[] = [];
    for (let r = range.r1; r <= range.r2; r += 1) {
      const row: string[] = [];
      for (let c = range.c1; c <= range.c2; c += 1) {
        const cell = sheet.cells[cellKey(c, r)];
        row.push(cell ? display(evaluator.valueAt(c, r), cell.fmt) : '');
      }
      lines.push(row.join('\t'));
    }
    return lines.join('\n');
  };
  const onCopy = (e: React.ClipboardEvent) => {
    if (editing) return;
    e.preventDefault();
    const text = rangeText(sel);
    const cells: (Cell | undefined)[][] = [];
    for (let r = sel.r1; r <= sel.r2; r += 1) {
      const row: (Cell | undefined)[] = [];
      for (let c = sel.c1; c <= sel.c2; c += 1) row.push(sheet.cells[cellKey(c, r)]);
      cells.push(row);
    }
    clipboard.current = { text, origin: { c: sel.c1, r: sel.r1 }, cells };
    e.clipboardData.setData('text/plain', text);
  };
  const onCut = (e: React.ClipboardEvent) => {
    if (editing || readOnly) return;
    onCopy(e);
    forRange(sel, () => null);
  };
  const onPaste = (e: React.ClipboardEvent) => {
    if (editing || readOnly) return;
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const changes: Record<string, Partial<Cell> | null> = {};
    const own = clipboard.current;
    if (own && own.text === text) {
      // 슐랙 안에서 복사한 칸: 꾸밈과 수식까지, 수식 참조는 옮긴 만큼
      own.cells.forEach((row, dr) =>
        row.forEach((cell, dc) => {
          const c = anchor.c + dc;
          const r = anchor.r + dr;
          if (c >= sheet.cols || r >= sheet.rows) return;
          changes[cellKey(c, r)] = cell
            ? { ...cell, v: moveFormula(cell.v, anchor.c - own.origin.c, anchor.r - own.origin.r) }
            : null;
        }),
      );
    } else {
      text
        .replace(/\r/g, '')
        .replace(/\n$/, '')
        .split('\n')
        .forEach((line, dr) =>
          line.split('\t').forEach((v, dc) => {
            const c = anchor.c + dc;
            const r = anchor.r + dr;
            if (c >= sheet.cols || r >= sheet.rows) return;
            changes[cellKey(c, r)] = { v };
          }),
        );
    }
    setCells(changes);
  };

  // ── 꾸미기
  const activeCell = sheet.cells[cellKey(anchor.c, anchor.r)];
  const toggleStyle = (prop: 'b' | 'i') => {
    const on = !activeCell?.[prop];
    forRange(sel, () => ({ [prop]: on || undefined }));
  };
  const setAlign = (align: Align) => forRange(sel, () => ({ align: activeCell?.align === align ? undefined : align }));
  const setColor = (prop: 'color' | 'bg', color: string | undefined) => forRange(sel, () => ({ [prop]: color }));
  const setFormat = (fmt: NumberFormat) => forRange(sel, () => ({ fmt: fmt === 'general' ? undefined : fmt }));

  // Σ: 고른 칸 아래(또는 한 칸이면 그 칸)에 위쪽 숫자의 합계
  const autoSum = () => {
    if (readOnly) return;
    if (sel.r1 === sel.r2 && sel.c1 === sel.c2) {
      let top = sel.r1 - 1;
      while (top >= 0 && typeof evaluator.valueAt(sel.c1, top) === 'number') top -= 1;
      if (top === sel.r1 - 1) {
        startEdit(anchor, '=SUM()');
        return;
      }
      setCells({
        [cellKey(sel.c1, sel.r1)]: { v: `=SUM(${cellKey(sel.c1, top + 1)}:${cellKey(sel.c1, sel.r1 - 1)})` },
      });
      return;
    }
    const r = Math.min(sel.r2 + 1, sheet.rows - 1);
    const changes: Record<string, Partial<Cell>> = {};
    for (let c = sel.c1; c <= sel.c2; c += 1) {
      changes[cellKey(c, r)] = { v: `=SUM(${cellKey(c, sel.r1)}:${cellKey(c, sel.r2)})` };
    }
    setCells(changes);
  };

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
    const limit = axis === 'row' ? MAX_ROWS - sheet.rows : MAX_COLS - sheet.cols;
    const n = Math.min(count, limit);
    if (n <= 0) return;
    updateSheet((s) => insertLines(s, axis, where === 'before' ? start : end + 1, n));
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
  const renameSheet = (name: string) => {
    const trimmed = name.trim().slice(0, 30);
    setRenaming(null);
    if (!trimmed || trimmed === sheet.name || readOnly) return;
    commit({ ...book, sheets: book.sheets.map((s, i) => (i === index ? { ...s, name: trimmed } : s)) });
  };

  // ── 화면에 그릴 행 (보이는 부분만)
  const first = Math.max(0, Math.floor(scroll.top / ROW_HEIGHT) - 5);
  const last = Math.min(sheet.rows - 1, Math.ceil((scroll.top + scroll.height) / ROW_HEIGHT) + 5);
  const cols = Array.from({ length: sheet.cols }, (_, c) => c);
  const totalWidth = HEADER_W + cols.reduce((sum, c) => sum + widthOf(sheet, c), 0);

  // 고른 칸의 합계·평균·개수
  const stats = useMemo(() => {
    let sum = 0;
    let count = 0;
    let filled = 0;
    const size = (sel.c2 - sel.c1 + 1) * (sel.r2 - sel.r1 + 1);
    if (size < 2 || size > 50_000) return null;
    for (let r = sel.r1; r <= sel.r2; r += 1) {
      for (let c = sel.c1; c <= sel.c2; c += 1) {
        if (!sheet.cells[cellKey(c, r)]) continue;
        const v = evaluator.valueAt(c, r);
        if (v !== null && v !== '') filled += 1;
        if (typeof v === 'number') {
          sum += v;
          count += 1;
        }
      }
    }
    return { sum, count, filled };
  }, [sel.c1, sel.c2, sel.r1, sel.r2, sheet, evaluator]);

  const barText = editing ? editing.text : activeCell?.v ?? '';

  return (
    <SheetWrap>
      {!readOnly && (
        <SheetToolbar role="toolbar" aria-label="스프레드시트 도구">
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
          <span className="sep" />
          <button
            type="button"
            className={activeCell?.b ? 'on' : undefined}
            onClick={() => toggleStyle('b')}
            title="굵게 (⌘B)"
            aria-label="굵게"
          >
            <Bold {...ICON} />
          </button>
          <button
            type="button"
            className={activeCell?.i ? 'on' : undefined}
            onClick={() => toggleStyle('i')}
            title="기울임 (⌘I)"
            aria-label="기울임"
          >
            <Italic {...ICON} />
          </button>
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
          <button
            type="button"
            onClick={() => {
              setColor('color', undefined);
              setColor('bg', undefined);
            }}
            title="색 없애기"
            aria-label="색 없애기"
          >
            <X {...ICON} />
          </button>
          <span className="sep" />
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
              className={activeCell?.align === align ? 'on' : undefined}
              onClick={() => setAlign(align)}
              title={label}
              aria-label={label}
            >
              <Icon {...ICON} />
            </button>
          ))}
          <span className="sep" />
          <button type="button" onClick={autoSum} title="합계 (SUM)" aria-label="합계">
            <Sigma {...ICON} />
          </button>
          <span className="sep" />
          <button type="button" onClick={() => lines('row', 'before')} title="위에 행 넣기" aria-label="위에 행 넣기">
            <Rows3 {...ICON} />
            <Plus size={11} />
          </button>
          <button type="button" onClick={() => lines('row', 'delete')} title="행 지우기" aria-label="행 지우기">
            <Rows3 {...ICON} />
            <Trash2 size={11} />
          </button>
          <button
            type="button"
            onClick={() => lines('col', 'before')}
            title="왼쪽에 열 넣기"
            aria-label="왼쪽에 열 넣기"
          >
            <Columns3 {...ICON} />
            <Plus size={11} />
          </button>
          <button type="button" onClick={() => lines('col', 'delete')} title="열 지우기" aria-label="열 지우기">
            <Columns3 {...ICON} />
            <Trash2 size={11} />
          </button>
        </SheetToolbar>
      )}
      <FormulaBar>
        <span className="name" aria-label="고른 칸">
          {rangeName(sel)}
        </span>
        <span className="fx">fx</span>
        <input
          id="sheet-formula"
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
      <Grid
        ref={gridRef}
        tabIndex={0}
        onKeyDown={onGridKey}
        onCopy={onCopy}
        onCut={onCut}
        onPaste={onPaste}
        role="grid"
        aria-label={`${sheet.name} 시트`}
        aria-readonly={readOnly}
      >
        <table style={{ width: totalWidth }}>
          <colgroup>
            <col style={{ width: HEADER_W }} />
            {cols.map((c) => (
              <col key={c} data-c={c} style={{ width: widthOf(sheet, c) }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th
                className="corner"
                aria-label="전체 고르기"
                onMouseDown={() => {
                  setAnchor({ c: 0, r: 0 });
                  setFocus({ c: sheet.cols - 1, r: sheet.rows - 1 });
                }}
              />
              {cols.map((c) => (
                <th
                  key={c}
                  className={c >= sel.c1 && c <= sel.c2 ? 'active' : undefined}
                  onMouseDown={(e) => selectCol(c, e.shiftKey)}
                >
                  {colName(c)}
                  <span className="resize" onMouseDown={onResizeDown(c)} aria-hidden="true" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {first > 0 && (
              <tr style={{ height: first * ROW_HEIGHT }} aria-hidden="true">
                <td colSpan={sheet.cols + 1} style={{ padding: 0, border: 'none' }} />
              </tr>
            )}
            {Array.from({ length: last - first + 1 }, (_, i) => first + i).map((r) => (
              <tr key={r}>
                <th
                  className={r >= sel.r1 && r <= sel.r2 ? 'active' : undefined}
                  onMouseDown={(e) => selectRow(r, e.shiftKey)}
                >
                  {r + 1}
                </th>
                {cols.map((c) => {
                  const key = cellKey(c, r);
                  const cell = sheet.cells[key];
                  const isEditing = editing && !editing.fromBar && editing.c === c && editing.r === r;
                  const value = cell ? evaluator.valueAt(c, r) : null;
                  const classes: string[] = [];
                  if (typeof value === 'number') classes.push('num');
                  if (value instanceof FormulaError) classes.push('err');
                  if (
                    c >= sel.c1 &&
                    c <= sel.c2 &&
                    r >= sel.r1 &&
                    r <= sel.r2 &&
                    (sel.c1 !== sel.c2 || sel.r1 !== sel.r2)
                  ) {
                    classes.push('in');
                  }
                  if (c === anchor.c && r === anchor.r) classes.push('cursor');
                  return (
                    <td
                      key={key}
                      className={classes.join(' ') || undefined}
                      style={
                        cell
                          ? {
                              fontWeight: cell.b ? 700 : undefined,
                              fontStyle: cell.i ? 'italic' : undefined,
                              textAlign: cell.align,
                              color: cell.color,
                              background: cell.bg,
                            }
                          : undefined
                      }
                      onMouseDown={onCellDown({ c, r })}
                      onMouseEnter={onCellEnter({ c, r })}
                      onDoubleClick={() => startEdit({ c, r })}
                      data-cell={key}
                    >
                      {isEditing ? (
                        <input
                          ref={editRef}
                          value={editing?.text ?? ''}
                          onChange={(e) => editing && setEditing({ ...editing, text: e.target.value })}
                          onKeyDown={onEditKey}
                          onBlur={() => finishEdit()}
                          aria-label={`${key} 고치기`}
                        />
                      ) : (
                        cell && display(value, cell.fmt)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {last < sheet.rows - 1 && (
              <tr style={{ height: (sheet.rows - 1 - last) * ROW_HEIGHT }} aria-hidden="true">
                <td colSpan={sheet.cols + 1} style={{ padding: 0, border: 'none' }} />
              </tr>
            )}
          </tbody>
        </table>
        {!readOnly && sheet.rows < MAX_ROWS && (
          <button
            type="button"
            onClick={() => updateSheet((s) => ({ ...s, rows: Math.min(MAX_ROWS, s.rows + 50) }))}
            style={{
              margin: '8px 0 8px 52px',
              padding: '4px 10px',
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            행 50개 더 넣기
          </button>
        )}
      </Grid>
      <StatusBar>
        <div className="tabs" role="tablist" aria-label="시트">
          {book.sheets.map((s, i) => (
            <span
              key={s.id}
              role="tab"
              tabIndex={0}
              aria-selected={i === index}
              className={`tab${i === index ? ' active' : ''}`}
              onClick={() => setSheetIndex(i)}
              onKeyDown={(e) => e.key === 'Enter' && setSheetIndex(i)}
              onDoubleClick={() => !readOnly && setRenaming(s.name)}
              title={readOnly ? s.name : '두 번 누르면 이름 바꾸기'}
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
              {!readOnly && i === index && book.sheets.length > 1 && renaming === null && (
                <span
                  className="x"
                  role="button"
                  aria-label={`${s.name} 시트 지우기`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSheet(i);
                  }}
                >
                  <X size={12} />
                </span>
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
              ? `합계 ${display(stats.sum, 'number')} · 평균 ${display(stats.sum / stats.count, 'number')} · 개수 ${
                  stats.filled
                }`
              : `개수 ${stats.filled}`}
          </span>
        )}
      </StatusBar>
    </SheetWrap>
  );
};

export default SheetEditor;
