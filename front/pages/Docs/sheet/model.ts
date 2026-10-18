import { colIndex, colName, FormulaError, formatGeneral, shiftFormula, Value } from './formula';

export type Align = 'left' | 'center' | 'right';
export type NumberFormat = 'general' | 'number' | 'percent' | 'currency';

export interface Cell {
  v: string; // 입력한 그대로 (수식은 = 로 시작)
  b?: boolean;
  i?: boolean;
  align?: Align;
  color?: string;
  bg?: string;
  fmt?: NumberFormat;
}

export interface Sheet {
  id: string;
  name: string;
  rows: number;
  cols: number;
  cells: Record<string, Cell>;
  widths: Record<string, number>; // 열 이름 → 너비(px)
}

export interface Workbook {
  v: 1;
  sheets: Sheet[];
}

export const MAX_ROWS = 2000;
export const MAX_COLS = 52;
export const DEFAULT_WIDTH = 100;
export const ROW_HEIGHT = 26;

const newId = () => Math.random().toString(36).slice(2, 10);

export const emptySheet = (name = '시트1', rows = 100, cols = 26): Sheet => ({
  id: newId(),
  name,
  rows,
  cols,
  cells: {},
  widths: {},
});

export const emptyWorkbook = (): Workbook => ({ v: 1, sheets: [emptySheet()] });

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
          cells: s.cells && typeof s.cells === 'object' ? s.cells : {},
          widths: s.widths && typeof s.widths === 'object' ? s.widths : {},
        })),
      };
    }
  } catch {
    // 아래에서 글을 첫 칸들에 넣는다
  }
  // 예전 글(탭·줄로 나뉜 표)이면 칸에 나눠 넣는다
  const sheet = emptySheet();
  content
    .split('\n')
    .slice(0, MAX_ROWS)
    .forEach((line, r) =>
      line
        .split('\t')
        .slice(0, MAX_COLS)
        .forEach((v, c) => {
          if (v) sheet.cells[`${colName(c)}${r + 1}`] = { v };
        }),
    );
  return { v: 1, sheets: [sheet] };
};

export const stringifyWorkbook = (book: Workbook) => JSON.stringify(book);

export const widthOf = (sheet: Sheet, c: number) => sheet.widths[colName(c)] || DEFAULT_WIDTH;

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

// 값 → 화면에 보일 글
export const display = (value: Value, fmt: NumberFormat = 'general') => {
  if (value instanceof FormulaError) return value.code;
  if (value === null) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') {
    switch (fmt) {
      case 'number':
        return value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
      case 'percent':
        return `${(value * 100).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}%`;
      case 'currency':
        return `₩${Math.round(value).toLocaleString('ko-KR')}`;
      default:
        return formatGeneral(value);
    }
  }
  return value;
};

// 행·열 넣기/지우기: 칸을 옮기고 수식 참조도 옮긴다
export const insertLines = (sheet: Sheet, axis: 'row' | 'col', at: number, count: number): Sheet => {
  const cells: Record<string, Cell> = {};
  Object.entries(sheet.cells).forEach(([key, cell]) => {
    const m = /^([A-Z]+)(\d+)$/.exec(key);
    if (!m) return;
    let c = colIndex(m[1]);
    let r = Number(m[2]) - 1;
    const index = axis === 'row' ? r : c;
    if (count < 0 && index >= at && index < at - count) return; // 지운 줄
    if (index >= at) {
      if (axis === 'row') r += count;
      else c += count;
    }
    cells[`${colName(c)}${r + 1}`] = { ...cell, v: shiftFormula(cell.v, axis, at, count) };
  });
  const widths: Record<string, number> = {};
  if (axis === 'col') {
    Object.entries(sheet.widths).forEach(([name, w]) => {
      const c = colIndex(name);
      if (count < 0 && c >= at && c < at - count) return;
      widths[colName(c >= at ? c + count : c)] = w;
    });
  }
  return {
    ...sheet,
    cells,
    widths: axis === 'col' ? widths : sheet.widths,
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
