import { cellKey, FormulaError, parseLiteral, Value } from './formula';
import { Cell, display, formatOf, moveFormula, parseRange, Range, Rule, Sheet } from './model';

type ValueAt = (c: number, r: number) => Value;

// ── 정렬: 범위 안의 행을 기준 열 값으로. 수식은 옮긴 만큼 참조를 옮긴다
const compare = (a: Value, b: Value) => {
  const rank = (v: Value) =>
    v === null || v === '' ? 3 : v instanceof FormulaError ? 2 : typeof v === 'number' ? 0 : 1;
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''), 'ko', { numeric: true });
};

export const sortRange = (
  sheet: Sheet,
  range: Range,
  byCol: number,
  desc: boolean,
  header: boolean,
  valueAt: ValueAt,
) => {
  const start = header ? range.r1 + 1 : range.r1;
  const rows: number[] = [];
  for (let r = start; r <= range.r2; r += 1) rows.push(r);
  const order = [...rows].sort((x, y) => {
    const d = compare(valueAt(byCol, x), valueAt(byCol, y));
    // 빈 칸은 언제나 끝으로
    const empty = (v: Value) => v === null || v === '';
    if (empty(valueAt(byCol, x)) || empty(valueAt(byCol, y))) return d;
    return desc ? -d : d;
  });
  const cells = { ...sheet.cells };
  const snapshot: Record<string, Cell | undefined> = {};
  rows.forEach((r) => {
    for (let c = range.c1; c <= range.c2; c += 1) snapshot[cellKey(c, r)] = sheet.cells[cellKey(c, r)];
  });
  order.forEach((from, i) => {
    const to = rows[i];
    for (let c = range.c1; c <= range.c2; c += 1) {
      const src = snapshot[cellKey(c, from)];
      if (src) cells[cellKey(c, to)] = { ...src, v: moveFormula(src.v, 0, to - from) };
      else delete cells[cellKey(c, to)];
    }
  });
  return { ...sheet, cells };
};

// ── 채우기 핸들: 고른 칸들을 끌어 늘린 방향으로 이어 채운다
// 숫자 둘 이상이면 같은 간격으로, 숫자 하나는 그대로, 끝에 숫자가 붙은 글은 1씩, 날짜는 하루씩, 수식은 참조를 옮겨서
export const fillCells = (sheet: Sheet, src: Range, dest: Range) => {
  const changes: Record<string, Cell | null> = {};
  const down = dest.r2 > src.r2;
  const up = dest.r1 < src.r1;
  const vertical = down || up;
  const lines = vertical ? src.c2 - src.c1 + 1 : src.r2 - src.r1 + 1;
  for (let line = 0; line < lines; line += 1) {
    const seq: { key: string; cell?: Cell }[] = [];
    const len = vertical ? src.r2 - src.r1 + 1 : src.c2 - src.c1 + 1;
    for (let i = 0; i < len; i += 1) {
      const c = vertical ? src.c1 + line : src.c1 + i;
      const r = vertical ? src.r1 + i : src.r1 + line;
      seq.push({ key: cellKey(c, r), cell: sheet.cells[cellKey(c, r)] });
    }
    const nums = seq.map((s) => (s.cell && !s.cell.v.startsWith('=') ? parseLiteral(s.cell.v) : null));
    const numeric = nums.every((n) => typeof n === 'number') && nums.length > 1;
    const step = numeric ? ((nums[nums.length - 1] as number) - (nums[0] as number)) / (nums.length - 1) : 0;
    const targets: { c: number; r: number; k: number }[] = [];
    if (vertical) {
      const c = src.c1 + line;
      if (down) for (let r = src.r2 + 1, k = 1; r <= dest.r2; r += 1, k += 1) targets.push({ c, r, k });
      if (up) for (let r = src.r1 - 1, k = -1; r >= dest.r1; r -= 1, k -= 1) targets.push({ c, r, k });
    } else {
      const r = src.r1 + line;
      if (dest.c2 > src.c2) for (let c = src.c2 + 1, k = 1; c <= dest.c2; c += 1, k += 1) targets.push({ c, r, k });
      if (dest.c1 < src.c1) for (let c = src.c1 - 1, k = -1; c >= dest.c1; c -= 1, k -= 1) targets.push({ c, r, k });
    }
    targets.forEach(({ c, r, k }) => {
      // k: 원본 끝(아래·오른쪽)에서 몇 칸 떨어졌는지 (위·왼쪽은 음수)
      const idx = k > 0 ? (k - 1) % len : (len - (((-k - 1) % len) + 1)) % len;
      const base = seq[idx];
      const from = vertical ? src.r1 + idx : src.c1 + idx;
      const to = vertical ? r : c;
      if (!base.cell) {
        changes[cellKey(c, r)] = null;
        return;
      }
      const cell: Cell = { ...base.cell };
      if (cell.v.startsWith('=')) {
        cell.v = vertical ? moveFormula(cell.v, 0, to - from) : moveFormula(cell.v, to - from, 0);
      } else if (numeric) {
        const first = nums[0] as number;
        const pos = k > 0 ? len - 1 + k : k;
        cell.v = String(Number((first + step * pos).toPrecision(12)));
      } else if (len === 1 && formatOf(base.cell) === 'date' && typeof nums[0] === 'number') {
        cell.v = display((nums[0] as number) + k, 'date');
      } else {
        const m = /^(.*?)(\d+)$/.exec(cell.v);
        if (m && len === 1) {
          const n = Number(m[2]) + k;
          cell.v = n >= 0 ? `${m[1]}${String(n).padStart(m[2].length, '0')}` : cell.v;
        }
      }
      changes[cellKey(c, r)] = cell;
    });
  }
  return changes;
};

// ── 필터: 숨길 행 번호 (머리글 아래만)
export const filteredRows = (sheet: Sheet, valueAt: ValueAt) => {
  const hidden = new Set<number>(sheet.hiddenRows || []);
  const f = sheet.filter;
  if (!f) return hidden;
  const range = parseRange(f.range);
  if (!range) return hidden;
  const entries = Object.entries(f.hidden).filter(([, values]) => values.length);
  if (!entries.length) return hidden;
  for (let r = range.r1 + 1; r <= range.r2; r += 1) {
    const out = entries.some(([col, values]) => {
      const c = Number(col);
      const text = display(valueAt(c, r), formatOf(sheet.cells[cellKey(c, r)]));
      return values.includes(text);
    });
    if (out) hidden.add(r);
  }
  return hidden;
};

export const columnValues = (sheet: Sheet, range: Range, c: number, valueAt: ValueAt) => {
  const set = new Set<string>();
  for (let r = range.r1 + 1; r <= range.r2; r += 1) {
    set.add(display(valueAt(c, r), formatOf(sheet.cells[cellKey(c, r)])));
  }
  return Array.from(set).sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'ko', { numeric: true })));
};

// ── 조건부 서식: 칸마다 덧입힐 모양
export interface RuleStyle {
  bg?: string;
  color?: string;
  bold?: boolean;
}

const mix = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa
    .map((x, i) =>
      Math.round(x + (pb[i] - x) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
};

export const ruleStyles = (rules: Rule[] | undefined, valueAt: ValueAt) => {
  const styles = new Map<string, RuleStyle>();
  (rules || []).forEach((rule) => {
    const range = parseRange(rule.range);
    if (!range) return;
    const cellsIn: { key: string; v: Value }[] = [];
    for (let r = range.r1; r <= range.r2; r += 1) {
      for (let c = range.c1; c <= range.c2; c += 1) cellsIn.push({ key: cellKey(c, r), v: valueAt(c, r) });
    }
    const nums = cellsIn.map((x) => x.v).filter((v): v is number => typeof v === 'number');
    const a = rule.a !== undefined ? parseLiteral(rule.a) : null;
    const b = rule.b !== undefined ? parseLiteral(rule.b) : null;
    const topN = rule.kind === 'top' ? [...nums].sort((x, y) => y - x)[Math.max(0, Number(a) - 1)] : undefined;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    cellsIn.forEach(({ key, v }) => {
      let hit = false;
      const n = typeof v === 'number' ? v : null;
      switch (rule.kind) {
        case 'gt':
          hit = n !== null && typeof a === 'number' && n > a;
          break;
        case 'lt':
          hit = n !== null && typeof a === 'number' && n < a;
          break;
        case 'between':
          hit =
            n !== null && typeof a === 'number' && typeof b === 'number' && n >= Math.min(a, b) && n <= Math.max(a, b);
          break;
        case 'eq':
          hit = v !== null && String(v).toLowerCase() === String(rule.a ?? '').toLowerCase();
          break;
        case 'contains':
          hit =
            v !== null &&
            !(v instanceof FormulaError) &&
            String(v)
              .toLowerCase()
              .includes(String(rule.a ?? '').toLowerCase());
          break;
        case 'empty':
          hit = v === null || v === '';
          break;
        case 'notEmpty':
          hit = !(v === null || v === '');
          break;
        case 'top':
          hit = n !== null && topN !== undefined && n >= topN;
          break;
        case 'scale':
          if (n !== null && max > min) {
            styles.set(key, {
              ...styles.get(key),
              bg: mix(rule.bg || '#ffffff', rule.color || '#57bb8a', (n - min) / (max - min)),
            });
          }
          return;
        default:
      }
      if (hit) {
        styles.set(key, {
          ...styles.get(key),
          ...(rule.bg ? { bg: rule.bg } : {}),
          ...(rule.color ? { color: rule.color } : {}),
          ...(rule.bold ? { bold: true } : {}),
        });
      }
    });
  });
  return styles;
};

// ── 병합
export const mergeAt = (sheet: Sheet) => {
  // 칸 → 그 칸이 속한 병합 (왼쪽 위 칸이 아니면 숨김)
  const map = new Map<string, Range>();
  (sheet.merges || []).forEach((text) => {
    const range = parseRange(text);
    if (!range) return;
    for (let r = range.r1; r <= range.r2; r += 1) {
      for (let c = range.c1; c <= range.c2; c += 1) map.set(cellKey(c, r), range);
    }
  });
  return map;
};
