import * as Y from 'yjs';

// 디자인(Figma 처럼): 페이지마다 프레임·도형·글을 놓는 캔버스.
// 공동 편집 상태(Yjs):
//   pages  Y.Array<Y.Map>  페이지 { id, name, bg }
//   nodes  Y.Map<Y.Map>    요소 id → 요소 속성 (아래 DNode)
//   pins   Y.Map<object>   댓글 스레드 id → 캔버스 위 위치 { page, node, x, y }
// 요소의 x·y 는 부모(프레임) 왼쪽 위 기준이라 프레임을 옮기면 안의 요소도 같이 움직인다.
// 선·화살표는 x·y 가 시작점, w·h 가 끝점까지의 거리(음수 가능)다.

export type NodeType = 'frame' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'text';
export type TextAlign = 'left' | 'center' | 'right';

export interface DNode {
  id: string;
  type: NodeType;
  page: string;
  parent: string | null;
  z: number;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  clip: boolean;
  shadow: boolean;
  text: string;
  fontSize: number;
  fontWeight: number;
  align: TextAlign;
  lineHeight: number;
  textMode: 'auto' | 'fixed';
}

export interface DPage {
  id: string;
  name: string;
  bg: string;
}

export interface Pin {
  page: string;
  node: string | null;
  x: number;
  y: number;
}

export interface Snapshot {
  pages: DPage[];
  nodes: Record<string, DNode>;
  // 부모(프레임 id, 또는 페이지 맨 위는 'page:<id>') → 아래에서 위 순서의 자식 id
  children: Record<string, string[]>;
  pins: Record<string, Pin>;
}

export interface Pt {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const LOCAL = 'design-local';
export const SEED = 'design-seed';

export const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', 'Segoe UI', sans-serif";

export const TYPE_LABELS: Record<NodeType, string> = {
  frame: '프레임',
  rect: '사각형',
  ellipse: '타원',
  line: '선',
  arrow: '화살표',
  text: '텍스트',
};

const BASE: Omit<DNode, 'id' | 'type' | 'page' | 'parent' | 'z'> = {
  name: '',
  x: 0,
  y: 0,
  w: 100,
  h: 100,
  rotation: 0,
  fill: '#d9d9d9',
  stroke: '',
  strokeWidth: 1,
  radius: 0,
  opacity: 1,
  visible: true,
  locked: false,
  clip: true,
  shadow: false,
  text: '',
  fontSize: 16,
  fontWeight: 400,
  align: 'left',
  lineHeight: 1.4,
  textMode: 'auto',
};

const TYPE_DEFAULTS: Record<NodeType, Partial<DNode>> = {
  frame: { fill: '#ffffff' },
  rect: {},
  ellipse: {},
  line: { fill: '', stroke: '#1e1e1e', strokeWidth: 2, h: 0 },
  arrow: { fill: '', stroke: '#1e1e1e', strokeWidth: 2, h: 0 },
  text: { fill: '#1e1e1e', w: 20, h: 22 },
};

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);

export const pageKey = (page: string) => `page:${page}`;
export const parentKeyOf = (node: Pick<DNode, 'parent' | 'page'>) => node.parent ?? pageKey(node.page);

export const isLine = (node: Pick<DNode, 'type'>) => node.type === 'line' || node.type === 'arrow';

export const displayName = (node: DNode) => {
  if (node.name) return node.name;
  if (node.type === 'text') return node.text.trim().split('\n')[0].slice(0, 40) || TYPE_LABELS.text;
  return TYPE_LABELS[node.type];
};

const yNodes = (doc: Y.Doc) => doc.getMap<Y.Map<unknown>>('nodes');
const yPages = (doc: Y.Doc) => doc.getArray<Y.Map<unknown>>('pages');
const yPins = (doc: Y.Doc) => doc.getMap<Pin>('pins');

export const trackedTypes = (doc: Y.Doc) => [yNodes(doc), yPages(doc), yPins(doc)];

const readNode = (id: string, map: Y.Map<unknown>): DNode => {
  const raw = map.toJSON() as Partial<DNode>;
  const type = (raw.type || 'rect') as NodeType;
  return { ...BASE, ...TYPE_DEFAULTS[type], ...raw, id, type } as DNode;
};

// 바뀐 요소만 새로 읽는다 (나머지는 이전 객체를 그대로 써서 다시 그리지 않게)
export const readSnapshot = (doc: Y.Doc, prev: Snapshot | null, changed: Set<string> | null): Snapshot => {
  const nodesMap = yNodes(doc);
  const nodes: Record<string, DNode> = {};
  nodesMap.forEach((map, id) => {
    const old = prev?.nodes[id];
    nodes[id] = old && changed && !changed.has(id) ? old : readNode(id, map);
  });
  const children: Record<string, string[]> = {};
  Object.keys(nodes).forEach((id) => {
    const node = nodes[id];
    // 부모가 지워졌으면 페이지 맨 위에 둔다
    const key = node.parent && nodes[node.parent] ? node.parent : pageKey(node.page);
    (children[key] = children[key] || []).push(id);
  });
  Object.keys(children).forEach((key) => {
    children[key].sort((a, b) => nodes[a].z - nodes[b].z || (a < b ? -1 : 1));
  });
  const pages = yPages(doc)
    .toArray()
    .map((p) => {
      const raw = p.toJSON() as Partial<DPage>;
      return { id: String(raw.id), name: String(raw.name || '페이지'), bg: String(raw.bg || '') };
    });
  const pins: Record<string, Pin> = {};
  yPins(doc).forEach((pin, threadId) => {
    pins[threadId] = pin;
  });
  return { pages, nodes, children, pins };
};

// 요소 id 를 바꿈 알림에서 뽑는다
export const changedIds = (events: Y.YEvent<Y.AbstractType<unknown>>[]) => {
  const ids = new Set<string>();
  events.forEach((event) => {
    if (event.path.length) {
      ids.add(String(event.path[0]));
    } else if (event.target instanceof Y.Map) {
      event.changes.keys.forEach((_v, key) => ids.add(key));
    }
  });
  return ids;
};

// ── 좌표 ──

export const childrenOf = (snap: Snapshot, key: string) => snap.children[key] || [];

// 부모의 절대 좌표 (페이지 기준)
export const originOf = (snap: Snapshot, id: string): Pt => {
  let x = 0;
  let y = 0;
  let parent = snap.nodes[id]?.parent;
  const seen = new Set<string>();
  while (parent && snap.nodes[parent] && !seen.has(parent)) {
    seen.add(parent);
    x += snap.nodes[parent].x;
    y += snap.nodes[parent].y;
    parent = snap.nodes[parent].parent;
  }
  return { x, y };
};

export const absPos = (snap: Snapshot, id: string): Pt => {
  const o = originOf(snap, id);
  const n = snap.nodes[id];
  return { x: o.x + n.x, y: o.y + n.y };
};

const rotatePt = (p: Pt, c: Pt, deg: number): Pt => {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { x: c.x + (p.x - c.x) * cos - (p.y - c.y) * sin, y: c.y + (p.x - c.x) * sin + (p.y - c.y) * cos };
};
export { rotatePt };

// 요소의 네 모서리 (절대 좌표, 돌린 것 반영)
export const cornersOf = (snap: Snapshot, id: string): Pt[] => {
  const n = snap.nodes[id];
  const p = absPos(snap, id);
  if (isLine(n)) {
    return [p, { x: p.x + n.w, y: p.y + n.h }];
  }
  const c = { x: p.x + n.w / 2, y: p.y + n.h / 2 };
  const pts = [
    { x: p.x, y: p.y },
    { x: p.x + n.w, y: p.y },
    { x: p.x + n.w, y: p.y + n.h },
    { x: p.x, y: p.y + n.h },
  ];
  return n.rotation ? pts.map((q) => rotatePt(q, c, n.rotation)) : pts;
};

export const boundsOfPoints = (pts: Pt[]): Box => {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};

export const boundsOf = (snap: Snapshot, id: string): Box => boundsOfPoints(cornersOf(snap, id));

export const unionBounds = (snap: Snapshot, ids: string[]): Box | null => {
  const pts: Pt[] = [];
  ids.forEach((id) => {
    if (snap.nodes[id]) pts.push(...cornersOf(snap, id));
  });
  return pts.length ? boundsOfPoints(pts) : null;
};

export const intersects = (a: Box, b: Box) =>
  a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;

export const contains = (b: Box, p: Pt) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

export const isAncestor = (snap: Snapshot, ancestor: string, id: string) => {
  let parent = snap.nodes[id]?.parent;
  const seen = new Set<string>();
  while (parent && !seen.has(parent)) {
    if (parent === ancestor) return true;
    seen.add(parent);
    parent = snap.nodes[parent]?.parent;
  }
  return false;
};

export const descendantsOf = (snap: Snapshot, id: string): string[] => {
  const out: string[] = [];
  const walk = (key: string) =>
    childrenOf(snap, key).forEach((child) => {
      out.push(child);
      walk(child);
    });
  walk(id);
  return out;
};

// 고른 것 중 조상이 함께 골라진 것은 뺀다 (조상을 옮기면 같이 움직이므로)
export const topLevelOf = (snap: Snapshot, ids: string[]) =>
  ids.filter((id) => snap.nodes[id] && !ids.some((other) => other !== id && isAncestor(snap, other, id)));

// 이 점 아래에서 가장 안쪽 프레임 (빼야 할 요소와 그 안은 건너뛴다)
export const frameAt = (snap: Snapshot, page: string, p: Pt, exclude: string[] = []): string | null => {
  let found: string | null = null;
  const walk = (key: string) => {
    childrenOf(snap, key).forEach((id) => {
      const n = snap.nodes[id];
      if (n.type !== 'frame' || !n.visible || exclude.includes(id)) return;
      if (contains(boundsOf(snap, id), p)) {
        found = id;
        walk(id);
      }
    });
  };
  walk(pageKey(page));
  return found;
};

// ── 고치기 ──

const setFields = (map: Y.Map<unknown>, fields: Partial<DNode>) => {
  (Object.keys(fields) as (keyof DNode)[]).forEach((key) => {
    if (key === 'id') return;
    const value = fields[key];
    if (value !== undefined && map.get(key) !== value) map.set(key, value);
  });
};

export const topZ = (snap: Snapshot, key: string) => {
  const list = childrenOf(snap, key);
  return list.length ? snap.nodes[list[list.length - 1]].z + 1 : 0;
};

export const makeNode = (type: NodeType, fields: Partial<DNode> & { page: string }): DNode => ({
  ...BASE,
  ...TYPE_DEFAULTS[type],
  parent: null,
  z: 0,
  ...fields,
  id: fields.id || newId(),
  type,
});

export const addNodes = (doc: Y.Doc, nodes: DNode[], origin: unknown = LOCAL) => {
  doc.transact(() => {
    const map = yNodes(doc);
    nodes.forEach((node) => {
      const y = new Y.Map<unknown>();
      map.set(node.id, y);
      setFields(y, node);
    });
  }, origin);
};

export const updateNodes = (doc: Y.Doc, changes: Record<string, Partial<DNode>>) => {
  doc.transact(() => {
    const map = yNodes(doc);
    Object.keys(changes).forEach((id) => {
      const y = map.get(id);
      if (y) setFields(y, changes[id]);
    });
  }, LOCAL);
};

export const deleteNodes = (doc: Y.Doc, snap: Snapshot, ids: string[]) => {
  const all = new Set<string>();
  ids.forEach((id) => {
    all.add(id);
    descendantsOf(snap, id).forEach((d) => all.add(d));
  });
  doc.transact(() => {
    const map = yNodes(doc);
    all.forEach((id) => map.delete(id));
  }, LOCAL);
};

// 다른 프레임(또는 페이지 맨 위)으로 옮긴다. 화면 위 위치는 그대로
export const reparent = (doc: Y.Doc, snap: Snapshot, ids: string[], parent: string | null, page: string) => {
  const target = parent ? absPos(snap, parent) : { x: 0, y: 0 };
  const key = parent ?? pageKey(page);
  let z = topZ(snap, key);
  const changes: Record<string, Partial<DNode>> = {};
  ids.forEach((id) => {
    const n = snap.nodes[id];
    if (!n || n.parent === parent || id === parent || (parent && isAncestor(snap, id, parent))) return;
    const abs = absPos(snap, id);
    changes[id] = { parent, page, x: abs.x - target.x, y: abs.y - target.y, z: z++ };
  });
  if (Object.keys(changes).length) updateNodes(doc, changes);
};

// 쌓는 순서 바꾸기
export const reorder = (doc: Y.Doc, snap: Snapshot, ids: string[], mode: 'front' | 'back' | 'forward' | 'backward') => {
  const changes: Record<string, Partial<DNode>> = {};
  ids.forEach((id) => {
    const n = snap.nodes[id];
    if (!n) return;
    const list = childrenOf(snap, parentKeyOf(n)).filter((s) => s === id || !ids.includes(s));
    const i = list.indexOf(id);
    const zOf = (k: number) => snap.nodes[list[k]].z;
    if (mode === 'front' && i < list.length - 1) changes[id] = { z: zOf(list.length - 1) + 1 };
    if (mode === 'back' && i > 0) changes[id] = { z: zOf(0) - 1 };
    if (mode === 'forward' && i < list.length - 1) {
      changes[id] = { z: i + 2 < list.length ? (zOf(i + 1) + zOf(i + 2)) / 2 : zOf(i + 1) + 1 };
    }
    if (mode === 'backward' && i > 0) {
      changes[id] = { z: i - 2 >= 0 ? (zOf(i - 1) + zOf(i - 2)) / 2 : zOf(i - 1) - 1 };
    }
  });
  if (Object.keys(changes).length) updateNodes(doc, changes);
};

// 레이어 목록에서 끌어 놓기: 어떤 요소 바로 위·아래, 또는 부모의 맨 위로
export type LayerSpot = { above: string } | { below: string } | 'top';

export const moveInLayers = (
  doc: Y.Doc,
  snap: Snapshot,
  id: string,
  parent: string | null,
  page: string,
  spot: LayerSpot,
) => {
  const node = snap.nodes[id];
  if (!node || id === parent || (parent && isAncestor(snap, id, parent))) return;
  // 아래→위 순서
  const list = childrenOf(snap, parent ?? pageKey(page)).filter((s) => s !== id);
  const zAt = (i: number) => snap.nodes[list[i]].z;
  let z: number;
  if (spot === 'top' || !list.length) {
    z = list.length ? zAt(list.length - 1) + 1 : 0;
  } else if ('above' in spot) {
    const i = list.indexOf(spot.above);
    z = i + 1 < list.length ? (zAt(i) + zAt(i + 1)) / 2 : zAt(i) + 1;
  } else {
    const i = list.indexOf(spot.below);
    z = i > 0 ? (zAt(i - 1) + zAt(i)) / 2 : zAt(i) - 1;
  }
  const target = parent ? absPos(snap, parent) : { x: 0, y: 0 };
  const abs = absPos(snap, id);
  updateNodes(doc, { [id]: { parent, page, z, x: abs.x - target.x, y: abs.y - target.y } });
};

// ── 복사·붙여넣기 ──

export interface Clip {
  shlackDesign: 1;
  // 맨 위 요소들은 절대 좌표, 그 안의 요소는 부모 기준
  nodes: DNode[];
}

export const CLIP_PREFIX = 'shlack-design:';

export const copyNodes = (snap: Snapshot, ids: string[]): Clip => {
  const roots = topLevelOf(snap, ids);
  const nodes: DNode[] = [];
  roots.forEach((id) => {
    const abs = absPos(snap, id);
    nodes.push({ ...snap.nodes[id], parent: null, x: abs.x, y: abs.y });
    descendantsOf(snap, id).forEach((d) => nodes.push(snap.nodes[d]));
  });
  return { shlackDesign: 1, nodes };
};

// 새 id 로 붙여 넣고, 맨 위 요소들의 id 를 돌려준다
export const pasteNodes = (
  doc: Y.Doc,
  snap: Snapshot,
  clip: Clip,
  page: string,
  parent: string | null,
  offset: Pt,
): string[] => {
  const ids = new Map<string, string>();
  clip.nodes.forEach((n) => ids.set(n.id, newId()));
  const target = parent ? absPos(snap, parent) : { x: 0, y: 0 };
  let z = topZ(snap, parent ?? pageKey(page));
  const roots: string[] = [];
  const nodes = clip.nodes.map((n) => {
    const isRoot = !n.parent || !ids.has(n.parent);
    const id = ids.get(n.id) as string;
    if (isRoot) roots.push(id);
    return makeNode(n.type, {
      ...n,
      id,
      page,
      parent: isRoot ? parent : (ids.get(n.parent as string) as string),
      x: isRoot ? n.x + offset.x - target.x : n.x,
      y: isRoot ? n.y + offset.y - target.y : n.y,
      z: isRoot ? z++ : n.z,
    });
  });
  addNodes(doc, nodes);
  return roots;
};

export const parseClip = (text: string): Clip | null => {
  if (!text.startsWith(CLIP_PREFIX)) return null;
  try {
    const clip = JSON.parse(text.slice(CLIP_PREFIX.length));
    return clip?.shlackDesign === 1 && Array.isArray(clip.nodes) ? clip : null;
  } catch {
    return null;
  }
};

// 고른 요소들을 새 프레임으로 감싼다
export const wrapInFrame = (doc: Y.Doc, snap: Snapshot, ids: string[], page: string): string | null => {
  const roots = topLevelOf(snap, ids);
  if (!roots.length) return null;
  const parent = snap.nodes[roots[0]].parent;
  const box = unionBounds(snap, roots);
  if (!box) return null;
  const origin = parent ? absPos(snap, parent) : { x: 0, y: 0 };
  const key = parent ?? pageKey(page);
  const frame = makeNode('frame', {
    page,
    parent,
    z: Math.min(...roots.map((id) => snap.nodes[id].z)),
    x: box.x - origin.x,
    y: box.y - origin.y,
    w: Math.max(1, box.w),
    h: Math.max(1, box.h),
    name: `프레임 ${childrenOf(snap, key).length + 1}`,
  });
  doc.transact(() => {
    addNodes(doc, [frame]);
    const changes: Record<string, Partial<DNode>> = {};
    roots.forEach((id) => {
      const abs = absPos(snap, id);
      changes[id] = { parent: frame.id, x: abs.x - box.x, y: abs.y - box.y };
    });
    updateNodes(doc, changes);
  }, LOCAL);
  return frame.id;
};

// ── 페이지 ──

export const addPage = (doc: Y.Doc, name: string) => {
  const id = newId();
  doc.transact(() => {
    const map = new Y.Map<unknown>();
    yPages(doc).push([map]);
    map.set('id', id);
    map.set('name', name);
  }, LOCAL);
  return id;
};

export const updatePage = (doc: Y.Doc, id: string, changes: Partial<DPage>) => {
  doc.transact(() => {
    const map = yPages(doc)
      .toArray()
      .find((p) => p.get('id') === id);
    if (!map) return;
    (Object.keys(changes) as (keyof DPage)[]).forEach((key) => {
      if (key !== 'id' && changes[key] !== undefined) map.set(key, changes[key]);
    });
  }, LOCAL);
};

export const deletePage = (doc: Y.Doc, snap: Snapshot, id: string) => {
  doc.transact(() => {
    const pages = yPages(doc);
    const index = pages.toArray().findIndex((p) => p.get('id') === id);
    if (index >= 0) pages.delete(index, 1);
    const nodes = yNodes(doc);
    Object.keys(snap.nodes).forEach((nid) => {
      if (snap.nodes[nid].page === id) nodes.delete(nid);
    });
  }, LOCAL);
};

// ── 댓글 핀 ──

export const setPin = (doc: Y.Doc, threadId: string, pin: Pin | null) => {
  doc.transact(() => {
    if (pin) yPins(doc).set(threadId, pin);
    else yPins(doc).delete(threadId);
  }, LOCAL);
};

export const pinPosition = (snap: Snapshot, pin: Pin): Pt => {
  if (pin.node && snap.nodes[pin.node]) {
    const p = absPos(snap, pin.node);
    return { x: p.x + pin.x, y: p.y + pin.y };
  }
  return { x: pin.x, y: pin.y };
};

// ── 처음 내용 (템플릿) ──

export interface DesignSeed {
  pages: { id: string; name: string; bg?: string }[];
  nodes: (Partial<DNode> & { id: string; type: NodeType; page: string })[];
}

export const parseDesignSeed = (content: string): DesignSeed | null => {
  if (!content.startsWith('design:')) return null;
  try {
    const seed = JSON.parse(content.slice('design:'.length));
    return Array.isArray(seed?.pages) && Array.isArray(seed?.nodes) ? seed : null;
  } catch {
    return null;
  }
};

export const isEmptyDesign = (doc: Y.Doc) => yPages(doc).length === 0;

export const seedDesign = (doc: Y.Doc, seed: DesignSeed | null) => {
  doc.transact(() => {
    const pages = yPages(doc);
    const list = seed?.pages.length ? seed.pages : [{ id: newId(), name: '페이지 1' }];
    list.forEach((p) => {
      const map = new Y.Map<unknown>();
      pages.push([map]);
      map.set('id', p.id);
      map.set('name', p.name);
      if (p.bg) map.set('bg', p.bg);
    });
    if (seed) {
      addNodes(
        doc,
        seed.nodes.map((n, i) => {
          const node = makeNode(n.type, { z: i, ...n });
          // 글 상자 크기는 이 화면의 글꼴로 잰다
          return node.type === 'text' ? { ...node, ...measureText(node) } : node;
        }),
        SEED,
      );
    }
  }, SEED);
};

// 검색·미리보기용 글: 페이지·프레임 이름과 글
export const toText = (snap: Snapshot) => {
  const lines: string[] = [];
  snap.pages.forEach((page) => {
    lines.push(`# ${page.name}`);
    const walk = (key: string, depth: number) =>
      childrenOf(snap, key).forEach((id) => {
        const n = snap.nodes[id];
        if (n.type === 'frame') lines.push(`${'  '.repeat(depth)}- ${displayName(n)}`);
        if (n.type === 'text' && n.text.trim()) lines.push(`${'  '.repeat(depth)}${n.text.trim()}`);
        walk(id, depth + 1);
      });
    walk(pageKey(page.id), 0);
    lines.push('');
  });
  return lines.join('\n').slice(0, 200_000);
};

// ── 글 크기 재기 ──

let measurer: HTMLDivElement | null = null;

export const measureText = (
  node: Pick<DNode, 'text' | 'fontSize' | 'fontWeight' | 'lineHeight' | 'textMode' | 'w'>,
) => {
  if (!measurer) {
    measurer = document.createElement('div');
    measurer.setAttribute('aria-hidden', 'true');
    Object.assign(measurer.style, {
      position: 'absolute',
      left: '-10000px',
      top: '0',
      visibility: 'hidden',
      wordBreak: 'break-word',
      fontFamily: FONT_FAMILY,
    });
    document.body.appendChild(measurer);
  }
  const m = measurer;
  m.style.fontSize = `${node.fontSize}px`;
  m.style.fontWeight = String(node.fontWeight);
  m.style.lineHeight = String(node.lineHeight);
  m.style.whiteSpace = node.textMode === 'auto' ? 'pre' : 'pre-wrap';
  m.style.width = node.textMode === 'auto' ? 'auto' : `${node.w}px`;
  // 끝 줄바꿈도 한 줄로 센다
  m.textContent = `${node.text || ' '}${node.text.endsWith('\n') ? ' ' : ''}`;
  return {
    w: node.textMode === 'auto' ? Math.ceil(m.offsetWidth) + 1 : node.w,
    h: Math.ceil(m.offsetHeight),
  };
};

// ── 코드 보기 (개발자용 CSS) ──

const px = (n: number) => `${Math.round(n * 100) / 100}px`;

export const cssOf = (node: DNode): string => {
  const lines: string[] = [];
  if (isLine(node)) {
    lines.push(`width: ${px(Math.hypot(node.w, node.h))};`);
    lines.push(`border-top: ${px(node.strokeWidth)} solid ${node.stroke || 'transparent'};`);
    const angle = (Math.atan2(node.h, node.w) * 180) / Math.PI;
    if (Math.abs(angle) > 0.01) lines.push(`transform: rotate(${Math.round(angle * 10) / 10}deg);`);
    return lines.join('\n');
  }
  lines.push(`width: ${px(node.w)};`);
  lines.push(`height: ${px(node.h)};`);
  if (node.type === 'text') {
    lines.push(`color: ${node.fill || 'inherit'};`);
    lines.push(`font-size: ${px(node.fontSize)};`);
    lines.push(`font-weight: ${node.fontWeight};`);
    lines.push(`line-height: ${node.lineHeight};`);
    if (node.align !== 'left') lines.push(`text-align: ${node.align};`);
  } else if (node.fill) {
    lines.push(`background: ${node.fill};`);
  }
  if (node.type === 'ellipse') lines.push('border-radius: 50%;');
  else if (node.radius) lines.push(`border-radius: ${px(node.radius)};`);
  if (node.stroke && node.type !== 'text') lines.push(`border: ${px(node.strokeWidth)} solid ${node.stroke};`);
  if (node.opacity < 1) lines.push(`opacity: ${Math.round(node.opacity * 100) / 100};`);
  if (node.shadow) lines.push('box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);');
  if (node.rotation) lines.push(`transform: rotate(${node.rotation}deg);`);
  if (node.type === 'frame' && node.clip) lines.push('overflow: hidden;');
  return lines.join('\n');
};
