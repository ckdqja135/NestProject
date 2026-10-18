// 스프레드시트 수식 계산기 (eval 을 쓰지 않는 작은 파서)
// 지원: 숫자·문자열·TRUE/FALSE, 셀(A1)·범위(A1:B3), + - * / ^ & % 비교(= <> < > <= >=),
//       SUM AVERAGE MIN MAX COUNT COUNTA IF ROUND ABS CONCAT LEN UPPER LOWER AND OR NOT

export class FormulaError {
  constructor(public code: '#DIV/0!' | '#VALUE!' | '#REF!' | '#NAME?' | '#ERROR!' | '#CYCLE!') {}

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

type Getter = (c: number, r: number) => Value;

// 범위·인자를 값 목록으로 펼친다 (빈 칸은 뺀다: 범위에서만)
const flatten = (nodes: Node[], ev: (n: Node) => Value, get: Getter) => {
  const out: { v: Value; fromRange: boolean }[] = [];
  nodes.forEach((node) => {
    if (node.k === 'range') {
      for (let r = node.r1; r <= node.r2; r += 1) {
        for (let c = node.c1; c <= node.c2; c += 1) {
          out.push({ v: get(c, r), fromRange: true });
        }
      }
    } else {
      out.push({ v: ev(node), fromRange: node.k === 'ref' });
    }
  });
  return out;
};

const MAX_RANGE_CELLS = 100_000;

const evaluate = (node: Node, get: Getter): Value => {
  const ev = (n: Node) => evaluate(n, get);
  switch (node.k) {
    case 'lit':
      return node.v;
    case 'ref':
      return get(node.c, node.r);
    case 'range':
      // 범위를 그대로 쓰면 왼쪽 위 칸 값
      if ((node.c2 - node.c1 + 1) * (node.r2 - node.r1 + 1) > MAX_RANGE_CELLS) return new FormulaError('#REF!');
      return get(node.c1, node.r1);
    case 'pct':
      return toNumber(ev(node.a)) / 100;
    case 'un': {
      const n = toNumber(ev(node.a));
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
          // 비교: 둘 다 숫자로 읽히면 숫자로, 아니면 대소문자 없이 글자로
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
      const values = () => flatten(args, ev, get);
      const numbers = () =>
        values()
          .filter(({ v, fromRange }) => !(fromRange && (v === null || typeof v === 'string' || typeof v === 'boolean')))
          .map(({ v }) => toNumber(v));
      switch (node.name) {
        case 'SUM':
          return numbers().reduce((s, n) => s + n, 0);
        case 'AVERAGE': {
          const list = numbers();
          if (!list.length) return new FormulaError('#DIV/0!');
          return list.reduce((s, n) => s + n, 0) / list.length;
        }
        case 'MIN': {
          const list = numbers();
          return list.length ? Math.min(...list) : 0;
        }
        case 'MAX': {
          const list = numbers();
          return list.length ? Math.max(...list) : 0;
        }
        case 'COUNT':
          return values().filter(({ v }) => typeof v === 'number').length;
        case 'COUNTA':
          return values().filter(({ v }) => v !== null && v !== '').length;
        case 'IF': {
          if (args.length < 2 || args.length > 3) return new FormulaError('#ERROR!');
          return toBool(ev(args[0])) ? ev(args[1]) : args[2] ? ev(args[2]) : false;
        }
        case 'ROUND': {
          const n = toNumber(ev(args[0]));
          const digits = args[1] ? Math.trunc(toNumber(ev(args[1]))) : 0;
          const f = 10 ** digits;
          return Math.round(n * f) / f;
        }
        case 'ABS':
          return Math.abs(toNumber(ev(args[0])));
        case 'CONCAT':
        case 'CONCATENATE':
          return values()
            .map(({ v }) => toText(v))
            .join('');
        case 'LEN':
          return toText(ev(args[0])).length;
        case 'UPPER':
          return toText(ev(args[0])).toUpperCase();
        case 'LOWER':
          return toText(ev(args[0])).toLowerCase();
        case 'AND':
          return values().every(({ v }) => toBool(v));
        case 'OR':
          return values().some(({ v }) => toBool(v));
        case 'NOT':
          return !toBool(ev(args[0]));
        default:
          return new FormulaError('#NAME?');
      }
    }
    default:
      return new FormulaError('#ERROR!');
  }
};

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
