import { colIndex, colName, formatDate, FormulaError, formatGeneral, parseRef, shiftFormula, Value } from './formula';

export type Align = 'left' | 'center' | 'right';
export type VAlign = 'top' | 'middle' | 'bottom';
export type NumberFormat = 'general' | 'number' | 'percent' | 'currency' | 'date' | 'text';

export interface Borders {
  t?: boolean;
  r?: boolean;
  b?: boolean;
  l?: boolean;
}

export interface Cell {
  v: string; // 입력한 그대로 (수식은 = 로 시작)
  b?: boolean;
  i?: boolean;
  u?: boolean;
  s?: boolean; // 취소선
  fs?: number; // 글자 크기
  align?: Align;
  valign?: VAlign;
  wrap?: boolean;
  color?: string;
  bg?: string;
  fmt?: NumberFormat;
  dp?: number; // 소수 자릿수
  border?: Borders;
  note?: string; // 메모
  list?: string[]; // 데이터 확인: 고를 수 있는 값
}

export type RuleKind = 'gt' | 'lt' | 'between' | 'eq' | 'contains' | 'empty' | 'notEmpty' | 'top' | 'scale';

// 조건부 서식
export interface Rule {
  id: string;
  range: string; // A1:C10
  kind: RuleKind;
  a?: string;
  b?: string;
  bg?: string;
  color?: string;
  bold?: boolean;
}

export type ChartType = 'column' | 'bar' | 'line' | 'area' | 'pie';

export interface SheetChart {
  id: string;
  type: ChartType;
  range: string;
  title?: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Filter {
  range: string; // 머리글 행을 포함한 범위
  hidden: Record<string, string[]>; // 열 번호 → 숨길 값
}

export interface Sheet {
  id: string;
  name: string;
  rows: number;
  cols: number;
  cells: Record<string, Cell>;
  widths: Record<string, number>; // 열 이름 → 너비(px)
  heights?: Record<string, number>; // 행 번호(1부터) → 높이(px)
  merges?: string[]; // 'A1:B2'
  freeze?: { r: number; c: number };
  filter?: Filter;
  rules?: Rule[];
  charts?: SheetChart[];
  hiddenRows?: number[];
  hiddenCols?: number[];
  color?: string; // 시트 탭 색
}

export interface Workbook {
  v: 1;
  sheets: Sheet[];
}

export const MAX_ROWS = 5000;
export const MAX_COLS = 78; // A ~ BZ
export const DEFAULT_WIDTH = 100;
export const ROW_HEIGHT = 26;

export const newId = () => Math.random().toString(36).slice(2, 10);

export const emptySheet = (name = '시트1', rows = 100, cols = 26): Sheet => ({
  id: newId(),
  name,
  rows,
  cols,
  cells: {},
  widths: {},
});

export const emptyWorkbook = (): Workbook => ({ v: 1, sheets: [emptySheet()] });

const arr = <T>(v: unknown): T[] | undefined => (Array.isArray(v) ? (v as T[]) : undefined);
const obj = <T>(v: unknown): T | undefined => (v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : undefined);

// 저장된 글을 통합 문서로 (깨졌거나 비었으면 빈 시트)
export const parseWorkbook = (content: string): Workbook => {
  if (!content.trim()) {
    return emptyWorkbook();
  }
  try {
    const data = JSON.parse(content);
    if (data && data.v === 1 && Array.isArray(data.sheets) && data.sheets.length) {
      return {
        v: 1,
        sheets: data.sheets.map((s: Partial<Sheet>, i: number) => ({
          id: typeof s.id === 'string' ? s.id : newId(),
          name: typeof s.name === 'string' && s.name ? s.name : `시트${i + 1}`,
          rows: Math.min(MAX_ROWS, Math.max(1, Number(s.rows) || 100)),
          cols: Math.min(MAX_COLS, Math.max(1, Number(s.cols) || 26)),
          cells: obj<Record<string, Cell>>(s.cells) || {},
          widths: obj<Record<string, number>>(s.widths) || {},
          heights: obj<Record<string, number>>(s.heights),
          merges: arr<string>(s.merges),
          freeze: obj<{ r: number; c: number }>(s.freeze),
          filter: obj<Filter>(s.filter),
          rules: arr<Rule>(s.rules),
          charts: arr<SheetChart>(s.charts),
          hiddenRows: arr<number>(s.hiddenRows),
          hiddenCols: arr<number>(s.hiddenCols),
          color: typeof s.color === 'string' ? s.color : undefined,
        })),
      };
    }
  } catch {
    // 아래에서 글을 첫 칸들에 넣는다
  }
  // 예전 글(탭·줄로 나뉜 표)이면 칸에 나눠 넣는다
  const sheet = emptySheet();
  sheet.cells = parseDelimited(content, '\t', 0, 0);
  return { v: 1, sheets: [sheet] };
};

export const stringifyWorkbook = (book: Workbook) => JSON.stringify(book);

export const widthOf = (sheet: Sheet, c: number) =>
  sheet.hiddenCols?.includes(c) ? 0 : sheet.widths[colName(c)] || DEFAULT_WIDTH;
export const heightOf = (sheet: Sheet, r: number) => sheet.heights?.[String(r + 1)] || ROW_HEIGHT;

// 범위: 시작·끝 칸 (어느 쪽이 먼저든)
export interface Range {
  c1: number;
  r1: number;
  c2: number;
  r2: number;
}
export const norm = (a: { c: number; r: number }, b: { c: number; r: number }): Range => ({
  c1: Math.min(a.c, b.c),
  r1: Math.min(a.r, b.r),
  c2: Math.max(a.c, b.c),
  r2: Math.max(a.r, b.r),
});
export const rangeName = (r: Range) =>
  r.c1 === r.c2 && r.r1 === r.r2
    ? `${colName(r.c1)}${r.r1 + 1}`
    : `${colName(r.c1)}${r.r1 + 1}:${colName(r.c2)}${r.r2 + 1}`;
export const parseRange = (text: string): Range | null => {
  const [a, b] = text.split(':');
  const p = parseRef(a || '');
  const q = parseRef(b || a || '');
  return p && q ? norm(p, q) : null;
};
export const inRange = (r: Range, c: number, row: number) => c >= r.c1 && c <= r.c2 && row >= r.r1 && row <= r.r2;
export const overlaps = (a: Range, b: Range) => a.c1 <= b.c2 && b.c1 <= a.c2 && a.r1 <= b.r2 && b.r1 <= a.r2;

// 값 → 화면에 보일 글
export const display = (value: Value, fmt: NumberFormat = 'general', dp?: number) => {
  if (value instanceof FormulaError) return value.code;
  if (value === null) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') {
    const fixed = (n: number, def: number) =>
      n.toLocaleString('ko-KR', {
        minimumFractionDigits: dp ?? 0,
        maximumFractionDigits: dp ?? def,
      });
    switch (fmt) {
      case 'number':
        return fixed(value, 2);
      case 'percent':
        return `${fixed(value * 100, 2)}%`;
      case 'currency':
        return `₩${fixed(dp === undefined ? Math.round(value) : value, 0)}`;
      case 'date':
        return Number.isInteger(value) ? formatDate(value) : formatDate(value, 'yyyy-mm-dd hh:nn');
      default:
        return dp === undefined ? formatGeneral(value) : value.toFixed(dp);
    }
  }
  return value;
};

// 날짜처럼 입력한 칸은 따로 형식을 고르지 않아도 날짜로 보여 준다
const DATE_INPUT = /^\s*\d{4}[-./]\d{1,2}[-./]\d{1,2}\s*$/;
export const formatOf = (cell?: Cell): NumberFormat =>
  cell?.fmt || (cell && DATE_INPUT.test(cell.v) ? 'date' : 'general');

// 행·열 넣기/지우기: 칸·병합·서식 범위를 옮기고 수식 참조도 옮긴다
const shiftIndex = (index: number, at: number, count: number) => {
  if (count < 0 && index >= at && index < at - count) return null;
  return index >= at ? index + count : index;
};
const shiftRangeText = (text: string, axis: 'row' | 'col', at: number, count: number) => {
  const r = parseRange(text);
  if (!r) return null;
  const s = (i: number, end: boolean) => {
    const v = shiftIndex(i, at, count);
    if (v !== null) return v;
    // 지운 줄에 걸친 끝은 남은 쪽으로 붙인다
    return end ? at - 1 : at;
  };
  const next =
    axis === 'row' ? { ...r, r1: s(r.r1, false), r2: s(r.r2, true) } : { ...r, c1: s(r.c1, false), c2: s(r.c2, true) };
  if (next.r2 < next.r1 || next.c2 < next.c1) return null;
  return rangeName(next);
};

export const insertLines = (sheet: Sheet, axis: 'row' | 'col', at: number, count: number): Sheet => {
  const cells: Record<string, Cell> = {};
  Object.entries(sheet.cells).forEach(([key, cell]) => {
    const p = parseRef(key);
    if (!p) return;
    const index = axis === 'row' ? p.r : p.c;
    const moved = shiftIndex(index, at, count);
    if (moved === null) return;
    const c = axis === 'col' ? moved : p.c;
    const r = axis === 'row' ? moved : p.r;
    cells[`${colName(c)}${r + 1}`] = { ...cell, v: shiftFormula(cell.v, axis, at, count) };
  });
  const widths: Record<string, number> = {};
  if (axis === 'col') {
    Object.entries(sheet.widths).forEach(([name, w]) => {
      const c = shiftIndex(colIndex(name), at, count);
      if (c !== null) widths[colName(c)] = w;
    });
  }
  let heights = sheet.heights;
  if (axis === 'row' && heights) {
    const next: Record<string, number> = {};
    Object.entries(heights).forEach(([row, h]) => {
      const r = shiftIndex(Number(row) - 1, at, count);
      if (r !== null) next[String(r + 1)] = h;
    });
    heights = next;
  }
  const shiftList = (list?: number[]) =>
    list?.map((i) => shiftIndex(i, at, count)).filter((i): i is number => i !== null);
  const merges = sheet.merges?.map((m) => shiftRangeText(m, axis, at, count)).filter((m): m is string => !!m);
  const rules = sheet.rules
    ?.map((rule) => ({ ...rule, range: shiftRangeText(rule.range, axis, at, count) || '' }))
    .filter((rule) => rule.range);
  const charts = sheet.charts
    ?.map((chart) => ({ ...chart, range: shiftRangeText(chart.range, axis, at, count) || '' }))
    .filter((chart) => chart.range);
  const filterRange = sheet.filter ? shiftRangeText(sheet.filter.range, axis, at, count) : null;
  return {
    ...sheet,
    cells,
    widths: axis === 'col' ? widths : sheet.widths,
    heights,
    merges,
    rules,
    charts,
    filter: filterRange && sheet.filter ? { ...sheet.filter, range: filterRange } : undefined,
    hiddenRows: axis === 'row' ? shiftList(sheet.hiddenRows) : sheet.hiddenRows,
    hiddenCols: axis === 'col' ? shiftList(sheet.hiddenCols) : sheet.hiddenCols,
    rows: axis === 'row' ? Math.min(MAX_ROWS, Math.max(1, sheet.rows + count)) : sheet.rows,
    cols: axis === 'col' ? Math.min(MAX_COLS, Math.max(1, sheet.cols + count)) : sheet.cols,
  };
};

// 복사한 칸의 수식을 붙여 넣는 위치만큼 옮긴다 ($ 가 붙은 쪽은 그대로)
export const moveFormula = (raw: string, dc: number, dr: number) => {
  if (!raw.startsWith('=')) return raw;
  return raw.replace(
    /"(?:[^"]|"")*"|(?<![A-Za-z0-9_$])(\$?)([A-Za-z]{1,3})(\$?)(\d{1,6})(?![A-Za-z0-9_(])/g,
    (match, d1, col, d2, row) => {
      if (match.startsWith('"') || col === undefined) return match;
      const c = d1 ? colIndex(col) : colIndex(col) + dc;
      const r = d2 ? Number(row) - 1 : Number(row) - 1 + dr;
      if (c < 0 || r < 0) return '#REF!';
      return `${d1}${colName(c)}${d2}${r + 1}`;
    },
  );
};

// ── CSV·탭 글
export const parseDelimited = (text: string, sep: string, c0: number, r0: number) => {
  const cells: Record<string, Cell> = {};
  let row = 0;
  let col = 0;
  let field = '';
  let quoted = false;
  const push = () => {
    if (field !== '' && r0 + row < MAX_ROWS && c0 + col < MAX_COLS) {
      cells[`${colName(c0 + col)}${r0 + row + 1}`] = { v: field };
    }
    field = '';
  };
  const src = text.replace(/\r\n?/g, '\n').replace(/\n$/, '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === '') {
      quoted = true;
    } else if (ch === sep) {
      push();
      col += 1;
    } else if (ch === '\n') {
      push();
      row += 1;
      col = 0;
    } else {
      field += ch;
    }
  }
  push();
  return cells;
};

export const toCsv = (rows: string[][]) =>
  rows.map((row) => row.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',')).join('\n');

// 데이터가 있는 마지막 칸
export const usedBounds = (sheet: Sheet) => {
  let maxC = -1;
  let maxR = -1;
  Object.keys(sheet.cells).forEach((key) => {
    const p = parseRef(key);
    if (p && sheet.cells[key].v !== '') {
      maxC = Math.max(maxC, p.c);
      maxR = Math.max(maxR, p.r);
    }
  });
  return { maxC, maxR };
};

// 고른 칸 둘레의 이어진 데이터 영역 (정렬·필터·차트에서 범위를 따로 고르지 않았을 때)
export const currentRegion = (sheet: Sheet, c: number, r: number): Range => {
  const filled = (cc: number, rr: number) => {
    const cell = sheet.cells[`${colName(cc)}${rr + 1}`];
    return !!cell && cell.v !== '';
  };
  let region: Range = { c1: c, r1: r, c2: c, r2: r };
  let grown = true;
  let guard = 0;
  while (grown && guard < 200) {
    guard += 1;
    grown = false;
    const { c1, r1, c2, r2 } = region;
    const rowHas = (rr: number) => {
      for (let cc = Math.max(0, c1 - 1); cc <= c2 + 1; cc += 1) if (filled(cc, rr)) return true;
      return false;
    };
    const colHas = (cc: number) => {
      for (let rr = Math.max(0, r1 - 1); rr <= r2 + 1; rr += 1) if (filled(cc, rr)) return true;
      return false;
    };
    if (r1 > 0 && rowHas(r1 - 1)) {
      region = { ...region, r1: r1 - 1 };
      grown = true;
    }
    if (r2 < sheet.rows - 1 && rowHas(r2 + 1)) {
      region = { ...region, r2: region.r2 + 1 };
      grown = true;
    }
    if (c1 > 0 && colHas(c1 - 1)) {
      region = { ...region, c1: c1 - 1 };
      grown = true;
    }
    if (c2 < sheet.cols - 1 && colHas(c2 + 1)) {
      region = { ...region, c2: region.c2 + 1 };
      grown = true;
    }
  }
  return region;
};
