// 스프레드시트 수식 계산기 (eval 을 쓰지 않는 작은 파서)
// 지원: 숫자·문자열·TRUE/FALSE, 셀(A1)·범위(A1:B3), + - * / ^ & % 비교(= <> < > <= >=),
//       SUM AVERAGE MIN MAX COUNT COUNTA IF ROUND ABS CONCAT LEN UPPER LOWER AND OR NOT

export class FormulaError {
  constructor(public code: '#DIV/0!' | '#VALUE!' | '#REF!' | '#NAME?' | '#ERROR!' | '#CYCLE!' | '#N/A') {}

  toString() {
    return this.code;
  }
}

export type Scalar = number | string | boolean | null; // null: 빈 칸
export type Value = Scalar | FormulaError;

// ── 셀 주소
export const colName = (index: number) => {
  let name = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
};

export const colIndex = (name: string) =>
  name
    .toUpperCase()
    .split('')
    .reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0) - 1;

export const cellKey = (c: number, r: number) => `${colName(c)}${r + 1}`;

const REF = /^\$?([A-Za-z]{1,3})\$?(\d{1,6})$/;
export const parseRef = (ref: string) => {
  const m = REF.exec(ref);
  if (!m) {
    return null;
  }
  return { c: colIndex(m[1]), r: Number(m[2]) - 1 };
};

// ── 입력값 해석 (수식이 아니면)
export const parseLiteral = (raw: string): Scalar => {
  const text = raw.trim();
  if (text === '') {
    return null;
  }
  if (/^[+-]?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?([eE][+-]?\d+)?$/.test(text) || /^[+-]?\.\d+$/.test(text)) {
    return Number(text.replace(/,/g, ''));
  }
  if (/^[+-]?\d+(\.\d+)?%$/.test(text)) {
    return Number(text.slice(0, -1)) / 100;
  }
  const date = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(text);
  if (date) {
    const [y, m, d] = [Number(date[1]), Number(date[2]), Number(date[3])];
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000;
    }
  }
  const upper = text.toUpperCase();
  if (upper === 'TRUE' || upper === 'FALSE') {
    return upper === 'TRUE';
  }
  return raw;
};

// ── 토큰
type Token =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'ref'; v: string }
  | { t: 'range'; a: string; b: string }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string };

const tokenize = (src: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (src.startsWith('#REF!', i)) {
      throw new FormulaError('#REF!');
    }
    if (ch === '"') {
      let j = i + 1;
      let text = '';
      while (j < src.length) {
        if (src[j] === '"') {
          if (src[j + 1] === '"') {
            text += '"';
            j += 2;
            continue;
          }
          break;
        }
        text += src[j];
        j += 1;
      }
      if (j >= src.length) {
        throw new FormulaError('#ERROR!');
      }
      tokens.push({ t: 'str', v: text });
      i = j + 1;
      continue;
    }
    const num = /^(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
    if (num) {
      tokens.push({ t: 'num', v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const word = /^\$?[A-Za-z_][A-Za-z0-9_.$]*/.exec(src.slice(i));
    if (word) {
      const text = word[0];
      i += text.length;
      if (REF.test(text)) {
        // 범위 A1:B2
        const rest = /^\s*:\s*(\$?[A-Za-z]{1,3}\$?\d{1,6})/.exec(src.slice(i));
        if (rest) {
          tokens.push({ t: 'range', a: text, b: rest[1] });
          i += rest[0].length;
        } else {
          tokens.push({ t: 'ref', v: text });
        }
      } else {
        tokens.push({ t: 'id', v: text.toUpperCase() });
      }
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === '<=' || two === '>=' || two === '<>') {
      tokens.push({ t: 'op', v: two });
      i += 2;
      continue;
    }
    if ('+-*/^&=<>(),%;'.includes(ch)) {
      tokens.push({ t: 'op', v: ch === ';' ? ',' : ch });
      i += 1;
      continue;
    }
    throw new FormulaError('#ERROR!');
  }
  return tokens;
};

// ── 구문 트리
type Node =
  | { k: 'lit'; v: Scalar }
  | { k: 'ref'; c: number; r: number }
  | { k: 'range'; c1: number; r1: number; c2: number; r2: number }
  | { k: 'un'; op: string; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'pct'; a: Node }
  | { k: 'call'; name: string; args: Node[] };

const parse = (tokens: Token[]): Node => {
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => peek()?.t === 'op' && (peek() as { v: string }).v === v;
  const expectOp = (v: string) => {
    if (!isOp(v)) {
      throw new FormulaError('#ERROR!');
    }
    pos += 1;
  };

  const primary = (): Node => {
    const tok = tokens[pos];
    if (!tok) {
      throw new FormulaError('#ERROR!');
    }
    pos += 1;
    if (tok.t === 'num') return { k: 'lit', v: tok.v };
    if (tok.t === 'str') return { k: 'lit', v: tok.v };
    if (tok.t === 'ref') {
      const ref = parseRef(tok.v);
      if (!ref) throw new FormulaError('#REF!');
      return { k: 'ref', ...ref };
    }
    if (tok.t === 'range') {
      const a = parseRef(tok.a);
      const b = parseRef(tok.b);
      if (!a || !b) throw new FormulaError('#REF!');
      return {
        k: 'range',
        c1: Math.min(a.c, b.c),
        r1: Math.min(a.r, b.r),
        c2: Math.max(a.c, b.c),
        r2: Math.max(a.r, b.r),
      };
    }
    if (tok.t === 'id') {
      if (tok.v === 'TRUE' || tok.v === 'FALSE') {
        if (isOp('(')) {
          pos += 2;
          return { k: 'lit', v: tok.v === 'TRUE' };
        }
        return { k: 'lit', v: tok.v === 'TRUE' };
      }
      if (tok.v === '#REF!') throw new FormulaError('#REF!');
      expectOp('(');
      const args: Node[] = [];
      if (!isOp(')')) {
        args.push(expr());
        while (isOp(',')) {
          pos += 1;
          args.push(expr());
        }
      }
      expectOp(')');
      return { k: 'call', name: tok.v, args };
    }
    if (tok.t === 'op' && tok.v === '(') {
      const inner = expr();
      expectOp(')');
      return inner;
    }
    throw new FormulaError('#ERROR!');
  };
  const postfix = (): Node => {
    let node = primary();
    while (isOp('%')) {
      pos += 1;
      node = { k: 'pct', a: node };
    }
    return node;
  };
  const unary = (): Node => {
    if (isOp('-') || isOp('+')) {
      const op = (tokens[pos] as { v: string }).v;
      pos += 1;
      return { k: 'un', op, a: unary() };
    }
    return postfix();
  };
  const binary =
    (next: () => Node, ops: string[], right = false) =>
    (): Node => {
      let node = next();
      while (peek()?.t === 'op' && ops.includes((peek() as { v: string }).v)) {
        const op = (tokens[pos] as { v: string }).v;
        pos += 1;
        if (right) {
          return { k: 'bin', op, a: node, b: binary(next, ops, true)() };
        }
        node = { k: 'bin', op, a: node, b: next() };
      }
      return node;
    };
  const power = binary(unary, ['^'], true);
  const term = binary(power, ['*', '/']);
  const additive = binary(term, ['+', '-']);
  const concat = binary(additive, ['&']);
  const compare = binary(concat, ['=', '<>', '<', '>', '<=', '>=']);
  const expr = compare;

  const node = expr();
  if (pos !== tokens.length) {
    throw new FormulaError('#ERROR!');
  }
  return node;
};

// ── 계산
const toNumber = (v: Value): number => {
  if (v instanceof FormulaError) throw v;
  if (v === null || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const lit = parseLiteral(v);
  if (typeof lit === 'number') return lit;
  throw new FormulaError('#VALUE!');
};

const toText = (v: Value): string => {
  if (v instanceof FormulaError) throw v;
  if (v === null) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return formatGeneral(v);
  return v;
};

const toBool = (v: Value): boolean => {
  if (v instanceof FormulaError) throw v;
  if (typeof v === 'boolean') return v;
  if (v === null) return false;
  if (typeof v === 'number') return v !== 0;
  const upper = v.toUpperCase();
  if (upper === 'TRUE') return true;
  if (upper === 'FALSE') return false;
  throw new FormulaError('#VALUE!');
};

export const formatGeneral = (n: number) => {
  if (!Number.isFinite(n)) return '#VALUE!';
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toPrecision(12)));
};

// ── 날짜: 엑셀처럼 1899-12-30 부터 센 날 수 (소수는 하루 중 시각)
const DAY_MS = 86_400_000;
const EPOCH = Date.UTC(1899, 11, 30);
export const toSerial = (y: number, m: number, d: number) => (Date.UTC(y, m - 1, d) - EPOCH) / DAY_MS;
export const fromSerial = (serial: number) => new Date(EPOCH + Math.floor(serial) * DAY_MS);
const nowSerial = () => {
  const now = new Date();
  return (
    toSerial(now.getFullYear(), now.getMonth() + 1, now.getDate()) +
    (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400
  );
};
export const formatDate = (serial: number, pattern = 'yyyy-mm-dd') => {
  const d = fromSerial(serial);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const frac = serial - Math.floor(serial);
  const secs = Math.round(frac * 86400);
  const pad = (n: number) => String(n).padStart(2, '0');
  return pattern
    .replace(/yyyy/gi, String(y))
    .replace(/yy/gi, pad(y % 100))
    .replace(/hh/gi, pad(Math.floor(secs / 3600)))
    .replace(/mm/g, pad(m))
    .replace(/MM/g, pad(m))
    .replace(/dd/gi, pad(day))
    .replace(/nn/gi, pad(Math.floor((secs % 3600) / 60)))
    .replace(/ss/gi, pad(secs % 60));
};

// TEXT() 서식: 0, 0.00, #,##0, 0%, yyyy-mm-dd …
const textFormat = (v: Value, fmt: string) => {
  const f = fmt.trim();
  if (/[yd]/i.test(f) && !/[0#]/.test(f)) {
    return formatDate(toNumber(v), f.replace(/m(?=[^m]*d)|(?<=y[^m]*)mm/gi, 'mm'));
  }
  const n = toNumber(v);
  const pct = f.endsWith('%');
  const body = pct ? f.slice(0, -1) : f;
  const decimals = body.includes('.') ? body.split('.')[1].replace(/[^0#]/g, '').length : 0;
  const value = pct ? n * 100 : n;
  const text = body.includes(',')
    ? value.toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : value.toFixed(decimals);
  return pct ? `${text}%` : text;
};

type Getter = (c: number, r: number) => Value;
type Matrix = Value[][];

const MAX_RANGE_CELLS = 200_000;

// 조건 글: ">=10", "<>완료", "사과*", "=" (빈 칸) …
const matcher = (criteria: Value) => {
  if (criteria instanceof FormulaError) throw criteria;
  if (typeof criteria === 'number' || typeof criteria === 'boolean') {
    return (v: Value) =>
      !(v instanceof FormulaError) &&
      v !== null &&
      (typeof v === 'number' || typeof v === 'boolean' || parseLiteral(String(v)) !== String(v)
        ? toNumberSafe(v) === toNumberSafe(criteria)
        : false);
  }
  const text = criteria === null ? '' : String(criteria);
  const m = /^(<=|>=|<>|<|>|=)?(.*)$/s.exec(text) as RegExpExecArray;
  const op = m[1] || '=';
  const operand = m[2];
  const num = parseLiteral(operand);
  if (typeof num === 'number') {
    return (v: Value) => {
      if (v instanceof FormulaError || v === null || v === '') return op === '<>';
      const x = toNumberSafe(v);
      if (x === null) return op === '<>';
      switch (op) {
        case '<':
          return x < num;
        case '>':
          return x > num;
        case '<=':
          return x <= num;
        case '>=':
          return x >= num;
        case '<>':
          return x !== num;
        default:
          return x === num;
      }
    };
  }
  const pattern = new RegExp(
    `^${operand
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')}$`,
    'i',
  );
  return (v: Value) => {
    if (v instanceof FormulaError) return false;
    const s2 =
      v === null ? '' : typeof v === 'number' ? formatGeneral(v) : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : v;
    if (op === '<>') return !pattern.test(s2);
    if (op === '=') return pattern.test(s2);
    const cmp = s2.toLowerCase().localeCompare(operand.toLowerCase());
    if (op === '<') return cmp < 0;
    if (op === '>') return cmp > 0;
    if (op === '<=') return cmp <= 0;
    return cmp >= 0;
  };
};
function toNumberSafe(v: Value): number | null {
  try {
    if (typeof v === 'string' && typeof parseLiteral(v) !== 'number') return null;
    return toNumber(v);
  } catch {
    return null;
  }
}

const evaluate = (node: Node, get: Getter): Value => {
  const ev = (n: Node) => evaluate(n, get);
  // 인자를 표(행×열)로: 범위면 칸들, 아니면 1×1
  const matrix = (n: Node): Matrix => {
    if (n.k === 'range') {
      if ((n.c2 - n.c1 + 1) * (n.r2 - n.r1 + 1) > MAX_RANGE_CELLS) throw new FormulaError('#REF!');
      const rows: Matrix = [];
      for (let r = n.r1; r <= n.r2; r += 1) {
        const row: Value[] = [];
        for (let c = n.c1; c <= n.c2; c += 1) row.push(get(c, r));
        rows.push(row);
      }
      return rows;
    }
    return [[ev(n)]];
  };
  // 모든 인자의 값을 펼친다 (범위·참조에서 온 글자·빈 칸은 숫자 함수에서 건너뛴다)
  const flat = (nodes: Node[]) => {
    const out: { v: Value; fromRange: boolean }[] = [];
    nodes.forEach((n) => {
      const fromRange = n.k === 'range' || n.k === 'ref';
      matrix(n).forEach((row) => row.forEach((v) => out.push({ v, fromRange })));
    });
    return out;
  };
  const numbers = (nodes: Node[]) =>
    flat(nodes)
      .filter(({ v, fromRange }) => {
        if (v instanceof FormulaError) throw v;
        return !(fromRange && (v === null || typeof v === 'string' || typeof v === 'boolean'));
      })
      .map(({ v }) => toNumber(v));
  const num = (n: Node) => toNumber(ev(n));
  const txt = (n: Node) => toText(ev(n));
  const arg = (args: Node[], i: number, min: number, max = min) => {
    if (args.length < min || args.length > max) throw new FormulaError('#ERROR!');
    return args[i];
  };

  switch (node.k) {
    case 'lit':
      return node.v;
    case 'ref':
      return get(node.c, node.r);
    case 'range':
      return get(node.c1, node.r1);
    case 'pct':
      return num(node.a) / 100;
    case 'un': {
      const n = num(node.a);
      return node.op === '-' ? -n : n;
    }
    case 'bin': {
      const a = ev(node.a);
      const b = ev(node.b);
      if (a instanceof FormulaError) return a;
      if (b instanceof FormulaError) return b;
      switch (node.op) {
        case '+':
          return toNumber(a) + toNumber(b);
        case '-':
          return toNumber(a) - toNumber(b);
        case '*':
          return toNumber(a) * toNumber(b);
        case '/': {
          const d = toNumber(b);
          if (d === 0) return new FormulaError('#DIV/0!');
          return toNumber(a) / d;
        }
        case '^':
          return toNumber(a) ** toNumber(b);
        case '&':
          return toText(a) + toText(b);
        default: {
          let x: number | string;
          let y: number | string;
          const na = typeof a === 'number' || typeof a === 'boolean' || a === null;
          const nb = typeof b === 'number' || typeof b === 'boolean' || b === null;
          if (na && nb) {
            x = toNumber(a);
            y = toNumber(b);
          } else {
            x = toText(a).toLowerCase();
            y = toText(b).toLowerCase();
          }
          switch (node.op) {
            case '=':
              return x === y;
            case '<>':
              return x !== y;
            case '<':
              return x < y;
            case '>':
              return x > y;
            case '<=':
              return x <= y;
            default:
              return x >= y;
          }
        }
      }
    }
    case 'call': {
      const args = node.args;
      const fn = FUNCTIONS[node.name];
      if (!fn) return new FormulaError('#NAME?');
      return fn({ args, ev, num, txt, matrix, flat, numbers, arg });
    }
    default:
      return new FormulaError('#ERROR!');
  }
};

interface Ctx {
  args: Node[];
  ev: (n: Node) => Value;
  num: (n: Node) => number;
  txt: (n: Node) => string;
  matrix: (n: Node) => Matrix;
  flat: (nodes: Node[]) => { v: Value; fromRange: boolean }[];
  numbers: (nodes: Node[]) => number[];
  arg: (args: Node[], i: number, min: number, max?: number) => Node;
}

const sum = (list: number[]) => list.reduce((s, n) => s + n, 0);
const sorted = (list: number[]) => [...list].sort((a, b) => a - b);

// 조건에 맞는 칸들의 짝 (SUMIF/COUNTIF/AVERAGEIF 와 …IFS)
const conditional = (c: Ctx, pairs: [Node, Node][], target?: Node) => {
  const ranges = pairs.map(([range]) => c.matrix(range).flat());
  const tests = pairs.map(([, crit]) => matcher(c.ev(crit)));
  const values = target ? c.matrix(target).flat() : ranges[0];
  const size = ranges[0].length;
  if (ranges.some((r) => r.length !== size) || values.length !== size) throw new FormulaError('#VALUE!');
  const hits: Value[] = [];
  for (let i = 0; i < size; i += 1) {
    if (tests.every((t, j) => t(ranges[j][i]))) hits.push(values[i]);
  }
  return hits;
};
const numericHits = (hits: Value[]) => hits.filter((v) => typeof v === 'number') as number[];

const lookupIndex = (list: Value[], key: Value, approximate: boolean) => {
  if (key instanceof FormulaError) throw key;
  if (!approximate) {
    const test =
      typeof key === 'string' ? matcher(key) : (v: Value) => v === key || toNumberSafe(v) === toNumberSafe(key);
    return list.findIndex((v) => test(v));
  }
  // 정렬된 목록에서 key 보다 크지 않은 마지막 값
  let found = -1;
  const k = typeof key === 'number' ? key : toNumberSafe(key);
  list.forEach((v, i) => {
    if (k !== null && typeof v === 'number' && v <= k) found = i;
    else if (k === null && typeof v === 'string' && typeof key === 'string' && v.toLowerCase() <= key.toLowerCase())
      found = i;
  });
  return found;
};

const FUNCTIONS: Record<string, (c: Ctx) => Value> = {
  // ── 수학·통계
  SUM: (c) => sum(c.numbers(c.args)),
  AVERAGE: (c) => {
    const list = c.numbers(c.args);
    if (!list.length) return new FormulaError('#DIV/0!');
    return sum(list) / list.length;
  },
  MIN: (c) => {
    const list = c.numbers(c.args);
    return list.length ? Math.min(...list) : 0;
  },
  MAX: (c) => {
    const list = c.numbers(c.args);
    return list.length ? Math.max(...list) : 0;
  },
  MEDIAN: (c) => {
    const list = sorted(c.numbers(c.args));
    if (!list.length) return new FormulaError('#VALUE!');
    const mid = Math.floor(list.length / 2);
    return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
  },
  PRODUCT: (c) => c.numbers(c.args).reduce((p, n) => p * n, 1),
  COUNT: (c) => c.flat(c.args).filter(({ v }) => typeof v === 'number').length,
  COUNTA: (c) => c.flat(c.args).filter(({ v }) => v !== null && v !== '').length,
  COUNTBLANK: (c) => c.flat(c.args).filter(({ v }) => v === null || v === '').length,
  ROUND: (c) => {
    const n = c.num(c.arg(c.args, 0, 1, 2));
    const f = 10 ** (c.args[1] ? Math.trunc(c.num(c.args[1])) : 0);
    return Math.round(n * f + Math.sign(n) * Number.EPSILON) / f;
  },
  ROUNDUP: (c) => {
    const n = c.num(c.arg(c.args, 0, 1, 2));
    const f = 10 ** (c.args[1] ? Math.trunc(c.num(c.args[1])) : 0);
    return (Math.sign(n) * Math.ceil(Math.abs(n) * f - 1e-9)) / f;
  },
  ROUNDDOWN: (c) => {
    const n = c.num(c.arg(c.args, 0, 1, 2));
    const f = 10 ** (c.args[1] ? Math.trunc(c.num(c.args[1])) : 0);
    return (Math.sign(n) * Math.floor(Math.abs(n) * f + 1e-9)) / f;
  },
  INT: (c) => Math.floor(c.num(c.arg(c.args, 0, 1))),
  TRUNC: (c) => Math.trunc(c.num(c.arg(c.args, 0, 1, 2))),
  ABS: (c) => Math.abs(c.num(c.arg(c.args, 0, 1))),
  MOD: (c) => {
    const d = c.num(c.arg(c.args, 1, 2));
    if (d === 0) return new FormulaError('#DIV/0!');
    const n = c.num(c.args[0]);
    return n - d * Math.floor(n / d);
  },
  POWER: (c) => c.num(c.arg(c.args, 0, 2)) ** c.num(c.args[1]),
  SQRT: (c) => {
    const n = c.num(c.arg(c.args, 0, 1));
    return n < 0 ? new FormulaError('#VALUE!') : Math.sqrt(n);
  },
  PI: () => Math.PI,
  RAND: () => Math.random(),
  RANDBETWEEN: (c) => {
    const lo = Math.ceil(c.num(c.arg(c.args, 0, 2)));
    const hi = Math.floor(c.num(c.args[1]));
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  },
  RANK: (c) => {
    const n = c.num(c.arg(c.args, 0, 2, 3));
    const list = c
      .matrix(c.args[1])
      .flat()
      .filter((v) => typeof v === 'number') as number[];
    const asc = c.args[2] ? c.num(c.args[2]) !== 0 : false;
    if (!list.includes(n)) return new FormulaError('#VALUE!');
    return list.filter((v) => (asc ? v < n : v > n)).length + 1;
  },
  LARGE: (c) => {
    const list = sorted(c.numbers([c.arg(c.args, 0, 2)])).reverse();
    const k = Math.trunc(c.num(c.args[1]));
    return k >= 1 && k <= list.length ? list[k - 1] : new FormulaError('#VALUE!');
  },
  SMALL: (c) => {
    const list = sorted(c.numbers([c.arg(c.args, 0, 2)]));
    const k = Math.trunc(c.num(c.args[1]));
    return k >= 1 && k <= list.length ? list[k - 1] : new FormulaError('#VALUE!');
  },
  SUMPRODUCT: (c) => {
    const mats = c.args.map((a) => c.matrix(a).flat());
    if (!mats.length || mats.some((m) => m.length !== mats[0].length)) return new FormulaError('#VALUE!');
    let total = 0;
    for (let i = 0; i < mats[0].length; i += 1) {
      total += mats.reduce((p, m) => p * (typeof m[i] === 'number' ? (m[i] as number) : 0), 1);
    }
    return total;
  },
  // ── 조건
  SUMIF: (c) => {
    c.arg(c.args, 0, 2, 3);
    return sum(numericHits(conditional(c, [[c.args[0], c.args[1]]], c.args[2])));
  },
  COUNTIF: (c) => conditional(c, [[c.arg(c.args, 0, 2), c.args[1]]]).length,
  AVERAGEIF: (c) => {
    c.arg(c.args, 0, 2, 3);
    const list = numericHits(conditional(c, [[c.args[0], c.args[1]]], c.args[2]));
    return list.length ? sum(list) / list.length : new FormulaError('#DIV/0!');
  },
  SUMIFS: (c) => {
    if (c.args.length < 3 || c.args.length % 2 === 0) return new FormulaError('#ERROR!');
    const pairs: [Node, Node][] = [];
    for (let i = 1; i < c.args.length; i += 2) pairs.push([c.args[i], c.args[i + 1]]);
    return sum(numericHits(conditional(c, pairs, c.args[0])));
  },
  COUNTIFS: (c) => {
    if (c.args.length < 2 || c.args.length % 2) return new FormulaError('#ERROR!');
    const pairs: [Node, Node][] = [];
    for (let i = 0; i < c.args.length; i += 2) pairs.push([c.args[i], c.args[i + 1]]);
    return conditional(c, pairs).length;
  },
  AVERAGEIFS: (c) => {
    if (c.args.length < 3 || c.args.length % 2 === 0) return new FormulaError('#ERROR!');
    const pairs: [Node, Node][] = [];
    for (let i = 1; i < c.args.length; i += 2) pairs.push([c.args[i], c.args[i + 1]]);
    const list = numericHits(conditional(c, pairs, c.args[0]));
    return list.length ? sum(list) / list.length : new FormulaError('#DIV/0!');
  },
  // ── 논리
  IF: (c) => {
    c.arg(c.args, 0, 2, 3);
    return toBool(c.ev(c.args[0])) ? c.ev(c.args[1]) : c.args[2] ? c.ev(c.args[2]) : false;
  },
  IFS: (c) => {
    if (!c.args.length || c.args.length % 2) return new FormulaError('#ERROR!');
    for (let i = 0; i < c.args.length; i += 2) {
      if (toBool(c.ev(c.args[i]))) return c.ev(c.args[i + 1]);
    }
    return new FormulaError('#VALUE!');
  },
  IFERROR: (c) => {
    c.arg(c.args, 0, 2);
    try {
      const v = c.ev(c.args[0]);
      return v instanceof FormulaError ? c.ev(c.args[1]) : v;
    } catch {
      return c.ev(c.args[1]);
    }
  },
  ISBLANK: (c) => {
    const v = c.ev(c.arg(c.args, 0, 1));
    return v === null || v === '';
  },
  ISNUMBER: (c) => typeof c.ev(c.arg(c.args, 0, 1)) === 'number',
  ISTEXT: (c) => typeof c.ev(c.arg(c.args, 0, 1)) === 'string',
  ISERROR: (c) => {
    try {
      return c.ev(c.arg(c.args, 0, 1)) instanceof FormulaError;
    } catch {
      return true;
    }
  },
  AND: (c) => c.flat(c.args).every(({ v }) => toBool(v)),
  OR: (c) => c.flat(c.args).some(({ v }) => toBool(v)),
  NOT: (c) => !toBool(c.ev(c.arg(c.args, 0, 1))),
  XOR: (c) => c.flat(c.args).filter(({ v }) => toBool(v)).length % 2 === 1,
  TRUE: () => true,
  FALSE: () => false,
  // ── 찾기
  VLOOKUP: (c) => {
    c.arg(c.args, 0, 3, 4);
    const table = c.matrix(c.args[1]);
    const col = Math.trunc(c.num(c.args[2]));
    const approx = c.args[3] ? toBool(c.ev(c.args[3])) : true;
    if (col < 1 || col > (table[0]?.length || 0)) return new FormulaError('#REF!');
    const i = lookupIndex(
      table.map((row) => row[0]),
      c.ev(c.args[0]),
      approx,
    );
    return i < 0 ? new FormulaError('#N/A') : table[i][col - 1];
  },
  HLOOKUP: (c) => {
    c.arg(c.args, 0, 3, 4);
    const table = c.matrix(c.args[1]);
    const row = Math.trunc(c.num(c.args[2]));
    const approx = c.args[3] ? toBool(c.ev(c.args[3])) : true;
    if (row < 1 || row > table.length) return new FormulaError('#REF!');
    const i = lookupIndex(table[0], c.ev(c.args[0]), approx);
    return i < 0 ? new FormulaError('#N/A') : table[row - 1][i];
  },
  XLOOKUP: (c) => {
    c.arg(c.args, 0, 3, 4);
    const look = c.matrix(c.args[1]).flat();
    const ret = c.matrix(c.args[2]).flat();
    const i = lookupIndex(look, c.ev(c.args[0]), false);
    if (i < 0) return c.args[3] ? c.ev(c.args[3]) : new FormulaError('#N/A');
    return ret[i] ?? new FormulaError('#N/A');
  },
  MATCH: (c) => {
    c.arg(c.args, 0, 2, 3);
    const list = c.matrix(c.args[1]).flat();
    const type = c.args[2] ? Math.trunc(c.num(c.args[2])) : 1;
    const i = lookupIndex(list, c.ev(c.args[0]), type !== 0);
    return i < 0 ? new FormulaError('#N/A') : i + 1;
  },
  INDEX: (c) => {
    c.arg(c.args, 0, 2, 3);
    const table = c.matrix(c.args[0]);
    let r = Math.trunc(c.num(c.args[1]));
    let col = c.args[2] ? Math.trunc(c.num(c.args[2])) : 1;
    // 한 줄짜리 범위는 두 번째 인자가 그 줄 안의 순서
    if (table.length === 1 && !c.args[2]) {
      col = r;
      r = 1;
    }
    const v = table[r - 1]?.[col - 1];
    return v === undefined ? new FormulaError('#REF!') : v;
  },
  CHOOSE: (c) => {
    const i = Math.trunc(c.num(c.arg(c.args, 0, 2, 255)));
    return i >= 1 && i < c.args.length ? c.ev(c.args[i]) : new FormulaError('#VALUE!');
  },
  ROWS: (c) => c.matrix(c.arg(c.args, 0, 1)).length,
  COLUMNS: (c) => c.matrix(c.arg(c.args, 0, 1))[0]?.length || 0,
  // ── 글자
  CONCAT: (c) =>
    c
      .flat(c.args)
      .map(({ v }) => toText(v))
      .join(''),
  CONCATENATE: (c) =>
    c
      .flat(c.args)
      .map(({ v }) => toText(v))
      .join(''),
  TEXTJOIN: (c) => {
    const sep = c.txt(c.arg(c.args, 0, 3, 255));
    const skip = toBool(c.ev(c.args[1]));
    return c
      .flat(c.args.slice(2))
      .map(({ v }) => toText(v))
      .filter((t) => !(skip && t === ''))
      .join(sep);
  },
  LEN: (c) => c.txt(c.arg(c.args, 0, 1)).length,
  UPPER: (c) => c.txt(c.arg(c.args, 0, 1)).toUpperCase(),
  LOWER: (c) => c.txt(c.arg(c.args, 0, 1)).toLowerCase(),
  PROPER: (c) =>
    c
      .txt(c.arg(c.args, 0, 1))
      .toLowerCase()
      .replace(/(^|[^a-z])([a-z])/g, (_, p, ch) => p + ch.toUpperCase()),
  TRIM: (c) => c.txt(c.arg(c.args, 0, 1)).trim().replace(/\s+/g, ' '),
  LEFT: (c) => c.txt(c.arg(c.args, 0, 1, 2)).slice(0, c.args[1] ? Math.max(0, c.num(c.args[1])) : 1),
  RIGHT: (c) => {
    const t = c.txt(c.arg(c.args, 0, 1, 2));
    const n = c.args[1] ? Math.max(0, c.num(c.args[1])) : 1;
    return n ? t.slice(-n) : '';
  },
  MID: (c) => {
    const t = c.txt(c.arg(c.args, 0, 3));
    const start = Math.trunc(c.num(c.args[1]));
    if (start < 1) return new FormulaError('#VALUE!');
    return t.substr(start - 1, Math.max(0, Math.trunc(c.num(c.args[2]))));
  },
  FIND: (c) => {
    const needle = c.txt(c.arg(c.args, 0, 2, 3));
    const hay = c.txt(c.args[1]);
    const i = hay.indexOf(needle, c.args[2] ? c.num(c.args[2]) - 1 : 0);
    return i < 0 ? new FormulaError('#VALUE!') : i + 1;
  },
  SEARCH: (c) => {
    const needle = c.txt(c.arg(c.args, 0, 2, 3)).toLowerCase();
    const hay = c.txt(c.args[1]).toLowerCase();
    const i = hay.indexOf(needle, c.args[2] ? c.num(c.args[2]) - 1 : 0);
    return i < 0 ? new FormulaError('#VALUE!') : i + 1;
  },
  SUBSTITUTE: (c) => {
    const t = c.txt(c.arg(c.args, 0, 3, 4));
    const from = c.txt(c.args[1]);
    const to = c.txt(c.args[2]);
    if (!from) return t;
    if (!c.args[3]) return t.split(from).join(to);
    const nth = Math.trunc(c.num(c.args[3]));
    let count = 0;
    return t.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), (m) => {
      count += 1;
      return count === nth ? to : m;
    });
  },
  REPLACE: (c) => {
    const t = c.txt(c.arg(c.args, 0, 4));
    const start = Math.trunc(c.num(c.args[1])) - 1;
    return t.slice(0, start) + c.txt(c.args[3]) + t.slice(start + Math.trunc(c.num(c.args[2])));
  },
  REPT: (c) => c.txt(c.arg(c.args, 0, 2)).repeat(Math.max(0, Math.min(1000, Math.trunc(c.num(c.args[1]))))),
  TEXT: (c) => textFormat(c.ev(c.arg(c.args, 0, 2)), c.txt(c.args[1])),
  VALUE: (c) => toNumber(c.ev(c.arg(c.args, 0, 1))),
  EXACT: (c) => c.txt(c.arg(c.args, 0, 2)) === c.txt(c.args[1]),
  // ── 날짜
  TODAY: () => Math.floor(nowSerial()),
  NOW: () => nowSerial(),
  DATE: (c) => toSerial(c.num(c.arg(c.args, 0, 3)), c.num(c.args[1]), c.num(c.args[2])),
  YEAR: (c) => fromSerial(c.num(c.arg(c.args, 0, 1))).getUTCFullYear(),
  MONTH: (c) => fromSerial(c.num(c.arg(c.args, 0, 1))).getUTCMonth() + 1,
  DAY: (c) => fromSerial(c.num(c.arg(c.args, 0, 1))).getUTCDate(),
  WEEKDAY: (c) => fromSerial(c.num(c.arg(c.args, 0, 1, 2))).getUTCDay() + 1,
  DAYS: (c) => Math.floor(c.num(c.arg(c.args, 0, 2))) - Math.floor(c.num(c.args[1])),
  EDATE: (c) => {
    const d = fromSerial(c.num(c.arg(c.args, 0, 2)));
    return toSerial(d.getUTCFullYear(), d.getUTCMonth() + 1 + Math.trunc(c.num(c.args[1])), d.getUTCDate());
  },
  EOMONTH: (c) => {
    const d = fromSerial(c.num(c.arg(c.args, 0, 2)));
    return toSerial(d.getUTCFullYear(), d.getUTCMonth() + 2 + Math.trunc(c.num(c.args[1])), 0);
  },
  NETWORKDAYS: (c) => {
    let a = Math.floor(c.num(c.arg(c.args, 0, 2)));
    let b = Math.floor(c.num(c.args[1]));
    const sign = a <= b ? 1 : -1;
    if (sign < 0) [a, b] = [b, a];
    let count = 0;
    for (let s2 = a; s2 <= b && count < 100000; s2 += 1) {
      const day = fromSerial(s2).getUTCDay();
      if (day !== 0 && day !== 6) count += 1;
    }
    return sign * count;
  },
};

// 수식 입력 도움말에 보여 줄 함수 이름
export const FUNCTION_NAMES = Object.keys(FUNCTIONS).sort();

const parsedCache = new Map<string, Node | FormulaError>();
const compile = (formula: string) => {
  let node = parsedCache.get(formula);
  if (!node) {
    try {
      node = parse(tokenize(formula));
    } catch (error) {
      node = error instanceof FormulaError ? error : new FormulaError('#ERROR!');
    }
    if (parsedCache.size > 5000) parsedCache.clear();
    parsedCache.set(formula, node);
  }
  return node;
};

// 시트 전체 계산기: 칸마다 한 번만 계산하고, 서로를 참조하면 #CYCLE!
export const createEvaluator = (rawOf: (key: string) => string | undefined) => {
  const cache = new Map<string, Value>();
  const visiting = new Set<string>();
  const valueOf = (c: number, r: number): Value => {
    if (c < 0 || r < 0) return new FormulaError('#REF!');
    const key = cellKey(c, r);
    if (cache.has(key)) return cache.get(key) as Value;
    const raw = rawOf(key);
    if (raw === undefined || raw === '') return null;
    if (!raw.startsWith('=') || raw.length === 1) {
      const lit = parseLiteral(raw);
      cache.set(key, lit);
      return lit;
    }
    if (visiting.has(key)) return new FormulaError('#CYCLE!');
    visiting.add(key);
    let result: Value;
    const node = compile(raw.slice(1));
    if (node instanceof FormulaError) {
      result = node;
    } else {
      try {
        result = evaluate(node, valueOf);
        if (typeof result === 'number' && !Number.isFinite(result)) result = new FormulaError('#DIV/0!');
      } catch (error) {
        result = error instanceof FormulaError ? error : new FormulaError('#ERROR!');
      }
    }
    visiting.delete(key);
    // 순환 중에 계산된 칸은 저장하지 않는다 (다른 경로에서 다시 계산)
    if (!(result instanceof FormulaError && result.code === '#CYCLE!')) cache.set(key, result);
    return result;
  };
  return {
    valueAt: valueOf,
    value: (key: string) => {
      const ref = parseRef(key);
      return ref ? valueOf(ref.c, ref.r) : null;
    },
  };
};

// 행·열을 넣거나 지울 때 수식 속 참조를 옮긴다 (지워진 칸을 가리키면 #REF!)
export const shiftFormula = (raw: string, axis: 'row' | 'col', at: number, delta: number) => {
  if (!raw.startsWith('=')) return raw;
  // 따옴표 밖의 참조만 바꾼다
  return raw.replace(
    /"(?:[^"]|"")*"|(?<![A-Za-z0-9_$])(\$?)([A-Za-z]{1,3})(\$?)(\d{1,6})(?![A-Za-z0-9_(])/g,
    (match, d1, col, d2, row) => {
      if (match.startsWith('"') || col === undefined) return match;
      let c = colIndex(col);
      let r = Number(row) - 1;
      const index = axis === 'row' ? r : c;
      if (delta < 0 && index >= at && index < at - delta) return '#REF!';
      if (index >= at) {
        if (axis === 'row') r += delta;
        else c += delta;
      }
      return `${d1}${colName(c)}${d2}${r + 1}`;
    },
  );
};
