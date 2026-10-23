import * as Y from 'yjs';

// 데이터베이스 (Notion 처럼): 항목(행)마다 속성(칸) 값을 두고, 같은 항목을 표·보드·캘린더·갤러리로 본다.
// 실시간 동시 편집(Yjs) 구조:
//   properties: Y.Array<Y.Map>  속성 목록 (순서대로)
//   views:      Y.Array<Y.Map>  보기 목록
//   order:      Y.Array<string> 항목 순서 (항목 id)
//   rows:       Y.Map<Y.Map>    항목 id → 값들 (속성 id → 값)
// 칸 하나하나가 따로 저장되므로, 여럿이 다른 칸을 동시에 고쳐도 서로 덮어쓰지 않는다.

export type PropType =
  | 'title'
  | 'text'
  | 'number'
  | 'select'
  | 'multiSelect'
  | 'status'
  | 'date'
  | 'person'
  | 'checkbox'
  | 'url';

export interface SelectOption {
  id: string;
  name: string;
  color: string;
}

export interface Property {
  id: string;
  name: string;
  type: PropType;
  options?: SelectOption[];
}

export type ViewType = 'table' | 'board' | 'calendar' | 'gallery';

export interface SortRule {
  prop: string;
  dir: 'asc' | 'desc';
}

export interface FilterRule {
  prop: string;
  op: 'is' | 'isNot' | 'contains' | 'empty' | 'notEmpty' | 'me';
  value?: string;
}

export interface View {
  id: string;
  name: string;
  type: ViewType;
  groupBy?: string; // 보드: 묶을 속성 (상태·선택·사람)
  dateProp?: string; // 캘린더: 날짜 속성
  sorts?: SortRule[];
  filters?: FilterRule[];
  hidden?: string[]; // 표·갤러리에서 숨긴 속성
}

export type CellValue = string | number | boolean | string[] | null | undefined;

export interface Row {
  id: string;
  values: Record<string, CellValue>;
  createdAt: number;
  createdBy: number | null;
}

export interface DatabaseState {
  properties: Property[];
  views: View[];
  rows: Row[]; // order 순서
}

export const TYPE_LABELS: Record<PropType, string> = {
  title: '이름',
  text: '글',
  number: '숫자',
  select: '선택',
  multiSelect: '여러 개 선택',
  status: '상태',
  date: '날짜',
  person: '사람',
  checkbox: '체크박스',
  url: '링크',
};

export const VIEW_LABELS: Record<ViewType, string> = {
  table: '표',
  board: '보드',
  calendar: '캘린더',
  gallery: '갤러리',
};

export const OPTION_COLORS = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const DEFAULT_STATUS: SelectOption[] = [
  { id: 'todo', name: '할 일', color: 'gray' },
  { id: 'doing', name: '진행 중', color: 'blue' },
  { id: 'done', name: '완료', color: 'green' },
];

// 새 데이터베이스의 기본 칸과 보기
export interface DatabaseSeed {
  properties: Property[];
  views: View[];
  rows: { values: Record<string, CellValue> }[];
}

export const defaultSeed = (): DatabaseSeed => ({
  properties: [
    { id: 'name', name: '이름', type: 'title' },
    { id: 'status', name: '상태', type: 'status', options: DEFAULT_STATUS },
    { id: 'owner', name: '담당자', type: 'person' },
    { id: 'due', name: '마감일', type: 'date' },
    { id: 'tags', name: '태그', type: 'multiSelect', options: [] },
  ],
  views: [
    { id: 'v-table', name: '표', type: 'table' },
    { id: 'v-board', name: '보드', type: 'board', groupBy: 'status' },
    { id: 'v-calendar', name: '캘린더', type: 'calendar', dateProp: 'due' },
    { id: 'v-gallery', name: '갤러리', type: 'gallery' },
  ],
  rows: [],
});

export const DATABASE_TEMPLATE_PREFIX = 'database:';

export const parseDatabaseSeed = (content: string): DatabaseSeed | null => {
  if (!content?.startsWith(DATABASE_TEMPLATE_PREFIX)) return null;
  try {
    const value = JSON.parse(content.slice(DATABASE_TEMPLATE_PREFIX.length));
    return Array.isArray(value?.properties) && Array.isArray(value?.views) ? value : null;
  } catch {
    return null;
  }
};

export const toDatabaseTemplate = (seed: DatabaseSeed) => `${DATABASE_TEMPLATE_PREFIX}${JSON.stringify(seed)}`;

// ---- Yjs 읽기·쓰기 ----

const yProps = (doc: Y.Doc) => doc.getArray<Y.Map<unknown>>('properties');
const yViews = (doc: Y.Doc) => doc.getArray<Y.Map<unknown>>('views');
const yOrder = (doc: Y.Doc) => doc.getArray<string>('order');
const yRows = (doc: Y.Doc) => doc.getMap<Y.Map<unknown>>('rows');

const toYMap = (value: Record<string, unknown>) => {
  const map = new Y.Map<unknown>();
  Object.entries(value).forEach(([k, v]) => {
    if (v !== undefined) map.set(k, v);
  });
  return map;
};

export const isEmpty = (doc: Y.Doc) => yProps(doc).length === 0;

export function seedDatabase(doc: Y.Doc, seed: DatabaseSeed, userId: number) {
  doc.transact(() => {
    seed.properties.forEach((p) => yProps(doc).push([toYMap({ ...p })]));
    seed.views.forEach((v) => yViews(doc).push([toYMap({ ...v })]));
    seed.rows.forEach((r) => {
      const id = newId();
      yRows(doc).set(id, toYMap({ ...r.values, __createdAt: Date.now(), __createdBy: userId }));
      yOrder(doc).push([id]);
    });
  });
}

export function readDatabase(doc: Y.Doc): DatabaseState {
  const properties = yProps(doc)
    .toArray()
    .map((m) => m.toJSON() as Property);
  const views = yViews(doc)
    .toArray()
    .map((m) => m.toJSON() as View);
  const rowsMap = yRows(doc);
  const seen = new Set<string>();
  const rows: Row[] = [];
  yOrder(doc)
    .toArray()
    .forEach((id) => {
      const map = rowsMap.get(id);
      if (!map || seen.has(id)) return;
      seen.add(id);
      const json = map.toJSON() as Record<string, CellValue>;
      const { __createdAt, __createdBy, ...values } = json;
      rows.push({ id, values, createdAt: Number(__createdAt) || 0, createdBy: (__createdBy as number) ?? null });
    });
  return { properties, views, rows };
}

const findIndex = (array: Y.Array<Y.Map<unknown>>, id: string) => array.toArray().findIndex((m) => m.get('id') === id);

export const db = {
  addRow(doc: Y.Doc, values: Record<string, CellValue>, userId: number, afterId?: string) {
    const id = newId();
    doc.transact(() => {
      yRows(doc).set(id, toYMap({ ...values, __createdAt: Date.now(), __createdBy: userId }));
      const order = yOrder(doc);
      const at = afterId ? order.toArray().indexOf(afterId) : -1;
      if (at >= 0) order.insert(at + 1, [id]);
      else order.push([id]);
    });
    return id;
  },
  setCell(doc: Y.Doc, rowId: string, propId: string, value: CellValue) {
    const row = yRows(doc).get(rowId);
    if (!row) return;
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) {
      row.delete(propId);
    } else {
      row.set(propId, value);
    }
  },
  deleteRow(doc: Y.Doc, rowId: string) {
    doc.transact(() => {
      yRows(doc).delete(rowId);
      const order = yOrder(doc);
      const at = order.toArray().indexOf(rowId);
      if (at >= 0) order.delete(at, 1);
    });
  },
  moveRow(doc: Y.Doc, rowId: string, beforeId: string | null) {
    doc.transact(() => {
      const order = yOrder(doc);
      const from = order.toArray().indexOf(rowId);
      if (from < 0) return;
      order.delete(from, 1);
      const to = beforeId ? order.toArray().indexOf(beforeId) : -1;
      order.insert(to >= 0 ? to : order.length, [rowId]);
    });
  },
  addProperty(doc: Y.Doc, prop: Omit<Property, 'id'>) {
    const id = newId();
    yProps(doc).push([toYMap({ ...prop, id })]);
    return id;
  },
  updateProperty(doc: Y.Doc, propId: string, changes: Partial<Property>) {
    const array = yProps(doc);
    const at = findIndex(array, propId);
    if (at < 0) return;
    const map = array.get(at);
    doc.transact(() => {
      Object.entries(changes).forEach(([k, v]) => (v === undefined ? map.delete(k) : map.set(k, v)));
    });
  },
  deleteProperty(doc: Y.Doc, propId: string) {
    const array = yProps(doc);
    const at = findIndex(array, propId);
    if (at < 0 || array.get(at).get('type') === 'title') return;
    doc.transact(() => {
      array.delete(at, 1);
      yRows(doc).forEach((row) => row.delete(propId));
    });
  },
  addView(doc: Y.Doc, view: Omit<View, 'id'>) {
    const id = newId();
    yViews(doc).push([toYMap({ ...view, id })]);
    return id;
  },
  updateView(doc: Y.Doc, viewId: string, changes: Partial<View>) {
    const array = yViews(doc);
    const at = findIndex(array, viewId);
    if (at < 0) return;
    const map = array.get(at);
    doc.transact(() => {
      Object.entries(changes).forEach(([k, v]) => (v === undefined ? map.delete(k) : map.set(k, v)));
    });
  },
  deleteView(doc: Y.Doc, viewId: string) {
    const array = yViews(doc);
    const at = findIndex(array, viewId);
    if (at >= 0 && array.length > 1) array.delete(at, 1);
  },
};

// ---- 보기: 거르기·정렬 ----

export const cellText = (prop: Property, value: CellValue, names: Record<number, string>): string => {
  if (value === null || value === undefined) return '';
  switch (prop.type) {
    case 'select':
    case 'status':
      return prop.options?.find((o) => o.id === value)?.name || '';
    case 'multiSelect':
      return (Array.isArray(value) ? value : [])
        .map((id) => prop.options?.find((o) => o.id === id)?.name)
        .filter(Boolean)
        .join(', ');
    case 'person':
      return (Array.isArray(value) ? value : [value])
        .map((id) => names[Number(id)])
        .filter(Boolean)
        .join(', ');
    case 'checkbox':
      return value ? '예' : '';
    default:
      return String(value);
  }
};

const isBlank = (value: CellValue) =>
  value === null || value === undefined || value === '' || value === false || (Array.isArray(value) && !value.length);

export function applyView(
  state: DatabaseState,
  view: View,
  search: string,
  me: number,
  names: Record<number, string>,
): Row[] {
  const props = new Map(state.properties.map((p) => [p.id, p]));
  let rows = state.rows;
  (view.filters || []).forEach((f) => {
    const prop = props.get(f.prop);
    if (!prop) return;
    rows = rows.filter((row) => {
      const value = row.values[prop.id];
      const list = Array.isArray(value) ? value.map(String) : isBlank(value) ? [] : [String(value)];
      switch (f.op) {
        case 'empty':
          return isBlank(value);
        case 'notEmpty':
          return !isBlank(value);
        case 'me':
          return list.includes(String(me));
        case 'is':
          return list.includes(String(f.value ?? ''));
        case 'isNot':
          return !list.includes(String(f.value ?? ''));
        case 'contains':
          return cellText(prop, value, names)
            .toLowerCase()
            .includes(String(f.value ?? '').toLowerCase());
        default:
          return true;
      }
    });
  });
  const q = search.trim().toLowerCase();
  if (q) {
    rows = rows.filter((row) =>
      state.properties.some((p) => cellText(p, row.values[p.id], names).toLowerCase().includes(q)),
    );
  }
  const sorts = view.sorts || [];
  if (sorts.length) {
    rows = [...rows].sort((a, b) => {
      for (const s of sorts) {
        const prop = props.get(s.prop);
        if (!prop) continue;
        const av = a.values[prop.id];
        const bv = b.values[prop.id];
        let cmp: number;
        if (prop.type === 'number') cmp = (Number(av) || 0) - (Number(bv) || 0);
        else if (prop.type === 'select' || prop.type === 'status') {
          const order = (v: CellValue) => prop.options?.findIndex((o) => o.id === v) ?? -1;
          cmp = order(av) - order(bv);
        } else cmp = cellText(prop, av, names).localeCompare(cellText(prop, bv, names), 'ko');
        // 빈 값은 항상 뒤로
        if (isBlank(av) !== isBlank(bv)) return isBlank(av) ? 1 : -1;
        if (cmp) return s.dir === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
  }
  return rows;
}

// 검색·미리보기용 마크다운 표
export function toMarkdown(state: DatabaseState, names: Record<number, string>) {
  const props = state.properties;
  const esc = (t: string) => t.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const head = `| ${props.map((p) => esc(p.name)).join(' | ')} |`;
  const line = `| ${props.map(() => '---').join(' | ')} |`;
  const body = state.rows.map((r) => `| ${props.map((p) => esc(cellText(p, r.values[p.id], names))).join(' | ')} |`);
  return [head, line, ...body].join('\n');
}
