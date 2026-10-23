import React, { FC, useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import {
  absPos,
  addNodes,
  Box,
  boundsOf,
  boundsOfPoints,
  childrenOf,
  copyNodes,
  cornersOf,
  deleteNodes,
  descendantsOf,
  displayName,
  DNode,
  FONT_FAMILY,
  frameAt,
  intersects,
  isLine,
  makeNode,
  measureText,
  NodeType,
  pageKey,
  pasteNodes,
  Pt,
  rotatePt,
  Snapshot,
  topLevelOf,
  topZ,
  TYPE_LABELS,
  unionBounds,
  updateNodes,
} from './model';
import { PageNodes } from './NodeView';
import { CanvasWrap } from './styles';

export type Tool = 'move' | 'hand' | 'frame' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'text' | 'comment';
export const SHAPE_TOOLS: Tool[] = ['frame', 'rect', 'ellipse', 'line', 'arrow'];

export interface View {
  x: number;
  y: number;
  zoom: number;
}

export interface Remote {
  clientId: number;
  name: string;
  color: string;
  cursor: Pt | null;
  selection: string[];
}

export interface PinView {
  threadId: string;
  pos: Pt;
  label: string;
  active: boolean;
}

export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 64;
export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export const BLUE = '#0d99ff';
const GUIDE = '#f24822';
const SNAP_PX = 5;

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const DIRS: Record<Handle, [number, number]> = {
  nw: [-1, -1],
  n: [0, -1],
  ne: [1, -1],
  e: [1, 0],
  se: [1, 1],
  s: [0, 1],
  sw: [-1, 1],
  w: [-1, 0],
};
const HANDLES = Object.keys(DIRS) as Handle[];

const ROTATE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M5 12a7 7 0 1 1 2 5" fill="none" stroke="white" stroke-width="4"/><path d="M5 12a7 7 0 1 1 2 5" fill="none" stroke="black" stroke-width="2"/><path d="M2 9l3 4 4-3" fill="none" stroke="black" stroke-width="2"/></svg>',
)}") 12 12, crosshair`;

// 손잡이 방향(돌린 각도 포함)에 맞는 마우스 모양
const resizeCursor = (dir: [number, number], rotation: number) => {
  const angle = ((((Math.atan2(dir[1], dir[0]) * 180) / Math.PI + rotation) % 180) + 180) % 180;
  if (angle < 22.5 || angle >= 157.5) return 'ew-resize';
  if (angle < 67.5) return 'nwse-resize';
  if (angle < 112.5) return 'ns-resize';
  return 'nesw-resize';
};

interface Guide {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// 옮기는 상자를 다른 요소의 가장자리·가운데에 맞춘다
const snapBox = (m: Box, cands: Box[], th: number) => {
  const mx = [m.x, m.x + m.w / 2, m.x + m.w];
  const my = [m.y, m.y + m.h / 2, m.y + m.h];
  let bx: number | null = null;
  let by: number | null = null;
  cands.forEach((c) => {
    const cx = [c.x, c.x + c.w / 2, c.x + c.w];
    const cy = [c.y, c.y + c.h / 2, c.y + c.h];
    mx.forEach((a) =>
      cx.forEach((b) => {
        const d = b - a;
        if (Math.abs(d) < th && (bx === null || Math.abs(d) < Math.abs(bx))) bx = d;
      }),
    );
    my.forEach((a) =>
      cy.forEach((b) => {
        const d = b - a;
        if (Math.abs(d) < th && (by === null || Math.abs(d) < Math.abs(by))) by = d;
      }),
    );
  });
  const dx = bx ?? 0;
  const dy = by ?? 0;
  return { dx, dy, guides: guidesFor({ ...m, x: m.x + dx, y: m.y + dy }, cands, bx !== null, by !== null) };
};

const guidesFor = (m: Box, cands: Box[], vertical: boolean, horizontal: boolean): Guide[] => {
  const out: Guide[] = [];
  const seen = new Set<string>();
  cands.forEach((c) => {
    if (vertical) {
      [m.x, m.x + m.w / 2, m.x + m.w].forEach((a) =>
        [c.x, c.x + c.w / 2, c.x + c.w].forEach((b) => {
          if (Math.abs(a - b) > 0.5 || seen.has(`v${b}`)) return;
          seen.add(`v${b}`);
          out.push({ x1: b, x2: b, y1: Math.min(m.y, c.y), y2: Math.max(m.y + m.h, c.y + c.h) });
        }),
      );
    }
    if (horizontal) {
      [m.y, m.y + m.h / 2, m.y + m.h].forEach((a) =>
        [c.y, c.y + c.h / 2, c.y + c.h].forEach((b) => {
          if (Math.abs(a - b) > 0.5 || seen.has(`h${b}`)) return;
          seen.add(`h${b}`);
          out.push({ y1: b, y2: b, x1: Math.min(m.x, c.x), x2: Math.max(m.x + m.w, c.x + c.w) });
        }),
      );
    }
  });
  return out.slice(0, 12);
};

const nearest = (value: number, list: number[], th: number) => {
  let best: number | null = null;
  list.forEach((v) => {
    if (Math.abs(v - value) < th && (best === null || Math.abs(v - value) < Math.abs(best - value))) best = v;
  });
  return best;
};

const round = (n: number) => Math.round(n);

type Drag =
  | { kind: 'pan'; sx: number; sy: number; view: View }
  | { kind: 'marquee'; start: Pt; scope: string; base: string[] }
  | {
      kind: 'move';
      start: Pt;
      ids: string[];
      origins: Record<string, Pt>;
      parentAbs: Record<string, Pt>;
      box: Box;
      cands: Box[];
      moved: boolean;
      alt: boolean;
      clicked: string;
      shiftClick: boolean;
      delta: Pt;
    }
  | {
      kind: 'resize';
      dir: [number, number];
      ids: string[];
      orig: Record<string, DNode>;
      parentAbs: Record<string, Pt>;
      box: Box;
      cands: Box[];
    }
  | { kind: 'rotate'; id: string; center: Pt; startAngle: number; rotation: number }
  | { kind: 'endpoint'; id: string; which: 'p1' | 'p2'; orig: DNode; parentAbs: Pt }
  | { kind: 'create'; type: NodeType; start: Pt; id: string | null; parent: string | null; parentAbs: Pt };

interface Props {
  doc: Y.Doc;
  snap: Snapshot;
  page: string;
  bg: string;
  editable: boolean;
  tool: Tool;
  onTool: (tool: Tool) => void;
  selection: string[];
  onSelect: (ids: string[]) => void;
  view: View;
  onView: React.Dispatch<React.SetStateAction<View>>;
  onSize: (size: { w: number; h: number }) => void;
  hover: string | null;
  onHover: (id: string | null) => void;
  editingText: string | null;
  onEditText: (id: string | null) => void;
  others: Remote[];
  pins: PinView[];
  onPin: (threadId: string) => void;
  onNewPin: (pos: Pt, node: string | null) => void;
  onCursor: (p: Pt | null) => void;
  onContextMenu: (client: Pt) => void;
  onGestureEnd: () => void;
  spaceDown: boolean;
}

const DesignCanvas: FC<Props> = (props) => {
  const { snap, page, view, selection, editable, tool, hover, editingText } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const dragRef = useRef<Drag | null>(null);
  const pendingRef = useRef<Record<string, Partial<DNode>>>({});
  const rafRef = useRef(0);
  const [dragKind, setDragKind] = useState<Drag['kind'] | null>(null);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  // 크기 알리기 (화면 맞춤에 쓴다)
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const report = () => latest.current.onSize({ w: el.clientWidth, h: el.clientHeight });
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 휠: 확대(⌘/Ctrl 또는 트랙패드 오므리기)·이동. React 의 onWheel 은 기본 동작을 막을 수 없어 직접 단다
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest?.('textarea, input')) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const delta = Math.max(-50, Math.min(50, e.deltaY));
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        latest.current.onView((v) => {
          const zoom = clampZoom(v.zoom * Math.exp(-delta * 0.01));
          return { zoom, x: sx - ((sx - v.x) * zoom) / v.zoom, y: sy - ((sy - v.y) * zoom) / v.zoom };
        });
      } else {
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
        latest.current.onView((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const toWorld = (clientX: number, clientY: number): Pt => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const v = latest.current.view;
    return { x: (clientX - rect.left - v.x) / v.zoom, y: (clientY - rect.top - v.y) / v.zoom };
  };
  const toScreen = (p: Pt): Pt => ({ x: p.x * view.zoom + view.x, y: p.y * view.zoom + view.y });

  // 끄는 동안 고친 값은 화면 한 번 그릴 때마다 모아서 보낸다
  const flush = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    const pending = pendingRef.current;
    pendingRef.current = {};
    if (Object.keys(pending).length) updateNodes(latest.current.doc, pending);
  };
  const schedule = (changes: Record<string, Partial<DNode>>) => {
    Object.keys(changes).forEach((id) => {
      pendingRef.current[id] = { ...pendingRef.current[id], ...changes[id] };
    });
    if (!rafRef.current) rafRef.current = requestAnimationFrame(flush);
  };

  // 누른 곳의 요소. 안에 요소가 있는 맨 위 프레임은 이름표를 눌러야 고른다 (Figma 와 같게)
  const hitAt = (target: EventTarget | null) => {
    const el = (target as Element | null)?.closest?.('[data-id]');
    const { snap: s } = latest.current;
    if (!el) return { id: null, scope: null as string | null, label: false };
    const id = el.getAttribute('data-id') as string;
    const label = el.hasAttribute('data-label');
    const node = s.nodes[id];
    if (!node) return { id: null, scope: null, label: false };
    if (!label && node.type === 'frame' && !node.parent && childrenOf(s, id).length) {
      return { id: null, scope: id, label: false };
    }
    return { id, scope: null, label };
  };

  // 맞춤 기준이 되는 다른 요소들
  const snapCandidates = (moving: string[]) => {
    const { snap: s, page: pg } = latest.current;
    const skip = new Set<string>();
    moving.forEach((id) => {
      skip.add(id);
      descendantsOf(s, id).forEach((d) => skip.add(d));
    });
    return Object.keys(s.nodes)
      .filter((id) => s.nodes[id].page === pg && s.nodes[id].visible && !skip.has(id))
      .map((id) => boundsOf(s, id));
  };

  const parentAbsOf = (s: Snapshot, id: string) => {
    const parent = s.nodes[id].parent;
    return parent && s.nodes[parent] ? absPos(s, parent) : { x: 0, y: 0 };
  };

  const startDrag = (drag: Drag, pointerId: number) => {
    dragRef.current = drag;
    setDragKind(drag.kind);
    wrapRef.current?.setPointerCapture(pointerId);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const p = latest.current;
    if (e.button === 2) return;
    const target = e.target as Element;
    if (target.closest('textarea, input, button')) return;
    const pin = target.closest('[data-pin]');
    if (pin) {
      p.onPin(pin.getAttribute('data-pin') as string);
      return;
    }
    const world = toWorld(e.clientX, e.clientY);
    const s = p.snap;

    if (e.button === 1 || p.tool === 'hand' || p.spaceDown) {
      startDrag({ kind: 'pan', sx: e.clientX, sy: e.clientY, view: p.view }, e.pointerId);
      return;
    }

    if (p.tool === 'comment') {
      const hit = hitAt(target);
      const anchor = hit.id || hit.scope || frameAt(s, p.page, world);
      p.onNewPin(world, anchor);
      p.onTool('move');
      return;
    }

    if (p.editable && p.tool === 'text') {
      // 누른 곳으로 포커스가 옮겨 가면 새 글 입력칸이 바로 닫힌다
      e.preventDefault();
      const parent = frameAt(s, p.page, world);
      const origin = parent ? absPos(s, parent) : { x: 0, y: 0 };
      const node = makeNode('text', {
        page: p.page,
        parent,
        z: topZ(s, parent ?? pageKey(p.page)),
        x: round(world.x - origin.x),
        y: round(world.y - origin.y),
      });
      addNodes(p.doc, [{ ...node, ...measureText(node) }]);
      p.onSelect([node.id]);
      p.onEditText(node.id);
      p.onTool('move');
      return;
    }

    if (p.editable && SHAPE_TOOLS.includes(p.tool)) {
      const parent = frameAt(s, p.page, world);
      startDrag(
        {
          kind: 'create',
          type: p.tool as NodeType,
          start: world,
          id: null,
          parent,
          parentAbs: parent ? absPos(s, parent) : { x: 0, y: 0 },
        },
        e.pointerId,
      );
      return;
    }

    const handle = target.closest('[data-handle]')?.getAttribute('data-handle');
    if (handle && p.editable) {
      const ids = topLevelOf(s, p.selection).filter((id) => !s.nodes[id].locked);
      if (!ids.length) return;
      if (handle === 'rot') {
        const id = ids[0];
        const b = absPos(s, id);
        const n = s.nodes[id];
        const center = { x: b.x + n.w / 2, y: b.y + n.h / 2 };
        startDrag(
          {
            kind: 'rotate',
            id,
            center,
            startAngle: Math.atan2(world.y - center.y, world.x - center.x),
            rotation: n.rotation,
          },
          e.pointerId,
        );
        return;
      }
      if (handle === 'p1' || handle === 'p2') {
        const id = ids[0];
        startDrag(
          { kind: 'endpoint', id, which: handle, orig: s.nodes[id], parentAbs: parentAbsOf(s, id) },
          e.pointerId,
        );
        return;
      }
      const orig: Record<string, DNode> = {};
      const parentAbs: Record<string, Pt> = {};
      ids.forEach((id) => {
        orig[id] = s.nodes[id];
        parentAbs[id] = parentAbsOf(s, id);
      });
      startDrag(
        {
          kind: 'resize',
          dir: DIRS[handle as Handle],
          ids,
          orig,
          parentAbs,
          box: unionBounds(s, ids) as Box,
          cands: snapCandidates(ids),
        },
        e.pointerId,
      );
      return;
    }

    const hit = hitAt(target);
    if (hit.id) {
      let next = p.selection;
      if (e.shiftKey) next = next.includes(hit.id) ? next.filter((id) => id !== hit.id) : [...next, hit.id];
      else if (!next.includes(hit.id)) next = [hit.id];
      p.onSelect(next);
      if (!p.editable || !next.includes(hit.id)) return;
      const ids = topLevelOf(s, next).filter((id) => !s.nodes[id].locked);
      if (!ids.length) return;
      const origins: Record<string, Pt> = {};
      const parentAbs: Record<string, Pt> = {};
      ids.forEach((id) => {
        origins[id] = { x: s.nodes[id].x, y: s.nodes[id].y };
        parentAbs[id] = parentAbsOf(s, id);
      });
      startDrag(
        {
          kind: 'move',
          start: world,
          ids,
          origins,
          parentAbs,
          box: unionBounds(s, ids) as Box,
          cands: snapCandidates(ids),
          moved: false,
          alt: e.altKey,
          clicked: hit.id,
          shiftClick: e.shiftKey,
          delta: { x: 0, y: 0 },
        },
        e.pointerId,
      );
      return;
    }

    if (!e.shiftKey) p.onSelect([]);
    startDrag(
      { kind: 'marquee', start: world, scope: hit.scope ?? pageKey(p.page), base: e.shiftKey ? p.selection : [] },
      e.pointerId,
    );
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = latest.current;
    const world = toWorld(e.clientX, e.clientY);
    p.onCursor(world);
    const drag = dragRef.current;
    if (!drag) {
      const hit = hitAt(e.target);
      if (hit.id !== p.hover) p.onHover(hit.id);
      return;
    }
    const s = p.snap;
    const th = SNAP_PX / p.view.zoom;
    const noSnap = e.metaKey || e.ctrlKey;

    if (drag.kind === 'pan') {
      p.onView({ ...drag.view, x: drag.view.x + e.clientX - drag.sx, y: drag.view.y + e.clientY - drag.sy });
      return;
    }

    if (drag.kind === 'marquee') {
      const box = boundsOfPoints([drag.start, world]);
      setMarquee(box);
      const picked = childrenOf(s, drag.scope).filter((id) => {
        const n = s.nodes[id];
        return n.visible && !n.locked && intersects(boundsOf(s, id), box);
      });
      const next = Array.from(new Set([...drag.base, ...picked]));
      if (next.join() !== p.selection.join()) p.onSelect(next);
      return;
    }

    if (drag.kind === 'move') {
      let dx = world.x - drag.start.x;
      let dy = world.y - drag.start.y;
      if (!drag.moved) {
        if (Math.hypot(dx, dy) * p.view.zoom < 3) return;
        drag.moved = true;
        p.onHover(null);
        // Alt(Option)을 누른 채 끌면 복제해서 옮긴다
        if (drag.alt) {
          const parent = s.nodes[drag.ids[0]].parent;
          const roots = pasteNodes(p.doc, s, copyNodes(s, drag.ids), p.page, parent, { x: 0, y: 0 });
          const target = parent ? absPos(s, parent) : { x: 0, y: 0 };
          const origins: Record<string, Pt> = {};
          const parentAbs: Record<string, Pt> = {};
          topLevelOf(s, drag.ids).forEach((id, i) => {
            const abs = absPos(s, id);
            origins[roots[i]] = { x: abs.x - target.x, y: abs.y - target.y };
            parentAbs[roots[i]] = target;
          });
          drag.ids = roots;
          drag.origins = origins;
          drag.parentAbs = parentAbs;
          p.onSelect(roots);
        }
      }
      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      let found: Guide[] = [];
      if (!noSnap) {
        const res = snapBox({ ...drag.box, x: drag.box.x + dx, y: drag.box.y + dy }, drag.cands, th);
        dx += res.dx;
        dy += res.dy;
        found = res.guides;
      }
      dx = round(dx);
      dy = round(dy);
      drag.delta = { x: dx, y: dy };
      setGuides(found);
      const changes: Record<string, Partial<DNode>> = {};
      drag.ids.forEach((id) => {
        changes[id] = { x: drag.origins[id].x + dx, y: drag.origins[id].y + dy };
      });
      schedule(changes);
      const target = frameAt(s, p.page, world, drag.ids);
      const current = s.nodes[drag.ids[0]]?.parent ?? null;
      setDropTarget(target !== current ? target : null);
      return;
    }

    if (drag.kind === 'rotate') {
      let deg =
        drag.rotation +
        ((Math.atan2(world.y - drag.center.y, world.x - drag.center.x) - drag.startAngle) * 180) / Math.PI;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      deg = ((((deg + 180) % 360) + 360) % 360) - 180;
      schedule({ [drag.id]: { rotation: Math.round(deg * 10) / 10 } });
      return;
    }

    if (drag.kind === 'endpoint') {
      const o = drag.orig;
      const start = { x: drag.parentAbs.x + o.x, y: drag.parentAbs.y + o.y };
      const end = { x: start.x + o.w, y: start.y + o.h };
      const fixed = drag.which === 'p1' ? end : start;
      let moving = world;
      if (e.shiftKey) {
        const angle = Math.round(Math.atan2(world.y - fixed.y, world.x - fixed.x) / (Math.PI / 4)) * (Math.PI / 4);
        const len = Math.hypot(world.x - fixed.x, world.y - fixed.y);
        moving = { x: fixed.x + len * Math.cos(angle), y: fixed.y + len * Math.sin(angle) };
      }
      const a = drag.which === 'p1' ? moving : start;
      const b = drag.which === 'p1' ? end : moving;
      schedule({
        [drag.id]: {
          x: round(a.x - drag.parentAbs.x),
          y: round(a.y - drag.parentAbs.y),
          w: round(b.x - a.x),
          h: round(b.y - a.y),
        },
      });
      return;
    }

    if (drag.kind === 'create') {
      const dist = Math.hypot(world.x - drag.start.x, world.y - drag.start.y) * p.view.zoom;
      if (!drag.id && dist < 3) return;
      let fields: Partial<DNode>;
      if (drag.type === 'line' || drag.type === 'arrow') {
        let end = world;
        if (e.shiftKey) {
          const angle =
            Math.round(Math.atan2(world.y - drag.start.y, world.x - drag.start.x) / (Math.PI / 4)) * (Math.PI / 4);
          end = {
            x: drag.start.x + (dist / p.view.zoom) * Math.cos(angle),
            y: drag.start.y + (dist / p.view.zoom) * Math.sin(angle),
          };
        }
        fields = {
          x: round(drag.start.x - drag.parentAbs.x),
          y: round(drag.start.y - drag.parentAbs.y),
          w: round(end.x - drag.start.x),
          h: round(end.y - drag.start.y),
        };
      } else {
        let w = world.x - drag.start.x;
        let h = world.y - drag.start.y;
        if (e.shiftKey) {
          const size = Math.max(Math.abs(w), Math.abs(h));
          w = Math.sign(w || 1) * size;
          h = Math.sign(h || 1) * size;
        }
        let end = { x: drag.start.x + w, y: drag.start.y + h };
        if (!noSnap && !e.shiftKey) {
          const cands = snapCandidates(drag.id ? [drag.id] : []);
          const xs = cands.reduce<number[]>((acc, c) => acc.concat([c.x, c.x + c.w / 2, c.x + c.w]), []);
          const ys = cands.reduce<number[]>((acc, c) => acc.concat([c.y, c.y + c.h / 2, c.y + c.h]), []);
          end = { x: nearest(end.x, xs, th) ?? end.x, y: nearest(end.y, ys, th) ?? end.y };
        }
        const box = boundsOfPoints([drag.start, end]);
        fields = {
          x: round(box.x - drag.parentAbs.x),
          y: round(box.y - drag.parentAbs.y),
          w: Math.max(1, round(box.w)),
          h: Math.max(1, round(box.h)),
        };
      }
      if (!drag.id) {
        const key = drag.parent ?? pageKey(p.page);
        const count = Object.keys(s.nodes).filter(
          (id) => s.nodes[id].page === p.page && s.nodes[id].type === drag.type,
        ).length;
        const node = makeNode(drag.type, {
          page: p.page,
          parent: drag.parent,
          z: topZ(s, key),
          name: `${TYPE_LABELS[drag.type]} ${count + 1}`,
          ...fields,
        });
        addNodes(p.doc, [node]);
        drag.id = node.id;
        p.onSelect([node.id]);
      } else {
        schedule({ [drag.id]: fields });
      }
      return;
    }

    if (drag.kind === 'resize') {
      const [dx, dy] = drag.dir;
      const single = drag.ids.length === 1 ? drag.orig[drag.ids[0]] : null;
      if (single) {
        const o = single;
        const pa = drag.parentAbs[o.id];
        const theta = o.rotation;
        const c0 = { x: pa.x + o.x + o.w / 2, y: pa.y + o.y + o.h / 2 };
        const anchor = rotatePt({ x: c0.x - (dx * o.w) / 2, y: c0.y - (dy * o.h) / 2 }, c0, theta);
        let pointer = world;
        const found: Guide[] = [];
        if (!theta && !noSnap) {
          const xs = drag.cands.reduce<number[]>((acc, c) => acc.concat([c.x, c.x + c.w / 2, c.x + c.w]), []);
          const ys = drag.cands.reduce<number[]>((acc, c) => acc.concat([c.y, c.y + c.h / 2, c.y + c.h]), []);
          const sx = dx ? nearest(world.x, xs, th) : null;
          const sy = dy ? nearest(world.y, ys, th) : null;
          pointer = { x: sx ?? world.x, y: sy ?? world.y };
        }
        const v = rotatePt(pointer, anchor, -theta);
        const local = { x: v.x - anchor.x, y: v.y - anchor.y };
        let w = dx ? Math.max(1, local.x * dx) : o.w;
        let h = dy ? Math.max(1, local.y * dy) : o.h;
        if (e.shiftKey && dx && dy) {
          const scale = Math.max(w / o.w, h / o.h);
          w = o.w * scale;
          h = o.h * scale;
        }
        w = Math.max(1, round(w));
        h = Math.max(1, round(h));
        const center = rotatePt(
          { x: anchor.x + (dx ? (dx * w) / 2 : 0), y: anchor.y + (dy ? (dy * h) / 2 : 0) },
          anchor,
          theta,
        );
        let fields: Partial<DNode> = { x: round(center.x - w / 2 - pa.x), y: round(center.y - h / 2 - pa.y), w, h };
        if (o.type === 'text') {
          fields = { x: fields.x, y: fields.y, w, textMode: 'fixed', h: measureText({ ...o, w, textMode: 'fixed' }).h };
        }
        if (!theta && !noSnap) {
          const box = { x: center.x - w / 2, y: center.y - h / 2, w, h };
          found.push(...guidesFor(box, drag.cands, !!dx, !!dy));
        }
        setGuides(found);
        schedule({ [o.id]: fields });
        return;
      }
      // 여러 개: 묶음 상자를 늘리고 안의 요소를 같은 비율로
      const b = drag.box;
      let x1 = b.x;
      let y1 = b.y;
      let x2 = b.x + b.w;
      let y2 = b.y + b.h;
      if (dx === -1) x1 = Math.min(world.x, x2 - 1);
      if (dx === 1) x2 = Math.max(world.x, x1 + 1);
      if (dy === -1) y1 = Math.min(world.y, y2 - 1);
      if (dy === 1) y2 = Math.max(world.y, y1 + 1);
      let sx = b.w ? (x2 - x1) / b.w : 1;
      let sy = b.h ? (y2 - y1) / b.h : 1;
      if (e.shiftKey && dx && dy) {
        const scale = Math.max(sx, sy);
        sx = scale;
        sy = scale;
        if (dx === -1) x1 = x2 - b.w * scale;
        if (dy === -1) y1 = y2 - b.h * scale;
      }
      const changes: Record<string, Partial<DNode>> = {};
      drag.ids.forEach((id) => {
        const o = drag.orig[id];
        const pa = drag.parentAbs[id];
        const ax = x1 + (pa.x + o.x - b.x) * sx;
        const ay = y1 + (pa.y + o.y - b.y) * sy;
        const w = isLine(o) ? round(o.w * sx) : Math.max(1, round(o.w * sx));
        const h = isLine(o) ? round(o.h * sy) : Math.max(1, round(o.h * sy));
        changes[id] =
          o.type === 'text'
            ? {
                x: round(ax - pa.x),
                y: round(ay - pa.y),
                w,
                textMode: 'fixed',
                h: measureText({ ...o, w, textMode: 'fixed' }).h,
              }
            : { x: round(ax - pa.x), y: round(ay - pa.y), w, h };
      });
      schedule(changes);
    }
  };

  const endDrag = (e: React.PointerEvent) => {
    const p = latest.current;
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    setDragKind(null);
    if (wrapRef.current?.hasPointerCapture(e.pointerId)) wrapRef.current.releasePointerCapture(e.pointerId);
    flush();
    setGuides([]);
    setMarquee(null);
    setDropTarget(null);
    const s = p.snap;
    const world = toWorld(e.clientX, e.clientY);

    if (drag.kind === 'move') {
      if (!drag.moved) {
        // 여럿 고른 상태에서 하나를 눌렀다 떼면 그것만 고른다
        if (!drag.shiftClick && p.selection.length > 1) p.onSelect([drag.clicked]);
        return;
      }
      // 프레임 안팎으로 옮겼으면 부모를 바꾼다
      const target = frameAt(s, p.page, world, drag.ids);
      const targetAbs = target ? absPos(s, target) : { x: 0, y: 0 };
      let z = topZ(s, target ?? pageKey(p.page));
      const changes: Record<string, Partial<DNode>> = {};
      drag.ids.forEach((id) => {
        const n = s.nodes[id];
        if (n && (n.parent ?? null) === target) return;
        const abs = {
          x: drag.parentAbs[id].x + drag.origins[id].x + drag.delta.x,
          y: drag.parentAbs[id].y + drag.origins[id].y + drag.delta.y,
        };
        changes[id] = { parent: target, x: abs.x - targetAbs.x, y: abs.y - targetAbs.y, z: z++ };
      });
      if (Object.keys(changes).length) updateNodes(p.doc, changes);
    }

    if (drag.kind === 'create') {
      let id = drag.id;
      if (!id) {
        // 누르기만 했으면 기본 크기로
        const line = drag.type === 'line' || drag.type === 'arrow';
        const key = drag.parent ?? pageKey(p.page);
        const count = Object.keys(s.nodes).filter(
          (n) => s.nodes[n].page === p.page && s.nodes[n].type === drag.type,
        ).length;
        const node = makeNode(drag.type, {
          page: p.page,
          parent: drag.parent,
          z: topZ(s, key),
          name: `${TYPE_LABELS[drag.type]} ${count + 1}`,
          x: round(drag.start.x - drag.parentAbs.x),
          y: round(drag.start.y - drag.parentAbs.y),
          w: 100,
          h: line ? 0 : 100,
        });
        addNodes(p.doc, [node]);
        id = node.id;
      } else if (drag.type === 'frame') {
        // 새 프레임 안에 완전히 들어간 요소는 프레임 안으로
        const frame = s.nodes[id];
        if (frame) {
          const fb = boundsOf(s, id);
          const key = drag.parent ?? pageKey(p.page);
          const inside = childrenOf(s, key).filter((other) => {
            if (other === id) return false;
            const ob = boundsOf(s, other);
            return ob.x >= fb.x && ob.y >= fb.y && ob.x + ob.w <= fb.x + fb.w && ob.y + ob.h <= fb.y + fb.h;
          });
          if (inside.length) {
            const changes: Record<string, Partial<DNode>> = {};
            inside.forEach((other) => {
              const abs = absPos(s, other);
              changes[other] = { parent: id as string, x: abs.x - fb.x, y: abs.y - fb.y };
            });
            updateNodes(p.doc, changes);
          }
        }
      }
      p.onSelect([id]);
      p.onTool('move');
    }
    p.onGestureEnd();
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const p = latest.current;
    const el = (e.target as Element).closest('[data-id]');
    if (!el || !p.editable) return;
    const id = el.getAttribute('data-id') as string;
    const node = p.snap.nodes[id];
    if (!node) return;
    if (el.hasAttribute('data-label')) {
      setRenaming(id);
      return;
    }
    if (node.type === 'text' && !node.locked) {
      p.onSelect([id]);
      p.onEditText(id);
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const p = latest.current;
    const hit = hitAt(e.target);
    if (hit.id && !p.selection.includes(hit.id)) p.onSelect([hit.id]);
    p.onContextMenu({ x: e.clientX, y: e.clientY });
  };

  // ── 화면 위 표시 (화면 좌표) ──
  const zoom = view.zoom;
  const nodes = snap.nodes;
  const sel = selection.filter((id) => nodes[id] && nodes[id].page === page);
  const showHandles = editable && !!sel.length && dragKind !== 'marquee' && dragKind !== 'pan' && !editingText;
  const poly = (pts: Pt[]) =>
    pts
      .map(toScreen)
      .map((q) => `${q.x},${q.y}`)
      .join(' ');

  const outline = (id: string, color: string, width = 1, key?: string) => {
    const n = nodes[id];
    if (!n) return null;
    const pts = cornersOf(snap, id);
    if (isLine(n)) {
      const [a, b] = pts.map(toScreen);
      return <line key={key || id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={width} />;
    }
    return <polygon key={key || id} points={poly(pts)} fill="none" stroke={color} strokeWidth={width} />;
  };

  let handles: React.ReactNode = null;
  let sizeLabel: { x: number; y: number; text: string } | null = null;
  if (sel.length) {
    const single = sel.length === 1 ? nodes[sel[0]] : null;
    if (single && isLine(single)) {
      const [a, b] = cornersOf(snap, single.id).map(toScreen);
      if (showHandles && !single.locked) {
        handles = (['p1', 'p2'] as const).map((h, i) => {
          const q = i ? b : a;
          return (
            <circle
              key={h}
              data-handle={h}
              cx={q.x}
              cy={q.y}
              r={5}
              fill="#fff"
              stroke={BLUE}
              strokeWidth={1.5}
              style={{ cursor: 'move', pointerEvents: 'all' }}
            />
          );
        });
      }
      sizeLabel = {
        x: (a.x + b.x) / 2,
        y: Math.max(a.y, b.y) + 10,
        text: `${Math.round(Math.hypot(single.w, single.h))}`,
      };
    } else {
      const rotated = single && single.rotation ? single : null;
      const pts = (
        rotated
          ? cornersOf(snap, rotated.id)
          : (() => {
              const box = unionBounds(snap, sel) as Box;
              return [
                { x: box.x, y: box.y },
                { x: box.x + box.w, y: box.y },
                { x: box.x + box.w, y: box.y + box.h },
                { x: box.x, y: box.y + box.h },
              ];
            })()
      ).map(toScreen);
      const [nw, ne, se, sw] = pts;
      const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      const at: Record<Handle, Pt> = {
        nw,
        n: mid(nw, ne),
        ne,
        e: mid(ne, se),
        se,
        s: mid(se, sw),
        sw,
        w: mid(sw, nw),
      };
      const rotation = rotated ? rotated.rotation : 0;
      const textOnly = single?.type === 'text';
      const small = Math.hypot(ne.x - nw.x, ne.y - nw.y) < 24 || Math.hypot(sw.x - nw.x, sw.y - nw.y) < 24;
      if (showHandles && !(single && single.locked)) {
        const list = HANDLES.filter((h) => (textOnly ? h === 'e' || h === 'w' : !small || h.length === 2));
        const canRotate = single && single.type !== 'frame';
        handles = (
          <>
            {canRotate &&
              (['nw', 'ne', 'se', 'sw'] as Handle[]).map((h) => {
                const c = { x: (nw.x + se.x) / 2, y: (nw.y + se.y) / 2 };
                const q = at[h];
                const len = Math.hypot(q.x - c.x, q.y - c.y) || 1;
                const ox = ((q.x - c.x) / len) * 12;
                const oy = ((q.y - c.y) / len) * 12;
                return (
                  <rect
                    key={`r-${h}`}
                    data-handle="rot"
                    x={q.x + ox - 9}
                    y={q.y + oy - 9}
                    width={18}
                    height={18}
                    fill="transparent"
                    style={{ cursor: ROTATE_CURSOR, pointerEvents: 'all' }}
                  />
                );
              })}
            {list.map((h) => (
              <rect
                key={h}
                data-handle={h}
                x={at[h].x - 4}
                y={at[h].y - 4}
                width={8}
                height={8}
                fill="#fff"
                stroke={BLUE}
                strokeWidth={1.5}
                transform={rotation ? `rotate(${rotation} ${at[h].x} ${at[h].y})` : undefined}
                style={{ cursor: resizeCursor(DIRS[h], rotation), pointerEvents: 'all' }}
              />
            ))}
          </>
        );
      }
      const w = single ? single.w : (unionBounds(snap, sel) as Box).w;
      const h = single ? single.h : (unionBounds(snap, sel) as Box).h;
      const bottom = Math.max(...pts.map((q) => q.y));
      sizeLabel = { x: (nw.x + se.x) / 2, y: bottom + 10, text: `${Math.round(w)} × ${Math.round(h)}` };
      handles = (
        <>
          {sel.length > 1 && <polygon points={pts.map((q) => `${q.x},${q.y}`).join(' ')} fill="none" stroke={BLUE} />}
          {handles}
        </>
      );
    }
  }

  const topFrames = childrenOf(snap, pageKey(page)).filter((id) => nodes[id].type === 'frame' && nodes[id].visible);
  const editing = editingText ? nodes[editingText] : null;
  const cursor =
    dragKind === 'pan'
      ? 'grabbing'
      : tool === 'hand' || props.spaceDown
      ? 'grab'
      : tool === 'text'
      ? 'text'
      : SHAPE_TOOLS.includes(tool) || tool === 'comment'
      ? 'crosshair'
      : 'default';

  return (
    <CanvasWrap
      ref={wrapRef}
      tabIndex={-1}
      style={{ background: props.bg, cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={() => {
        if (!dragRef.current) {
          props.onCursor(null);
          props.onHover(null);
        }
      }}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      aria-label="디자인 캔버스"
    >
      <svg className="world" width="100%" height="100%">
        <g transform={`translate(${view.x} ${view.y}) scale(${zoom})`}>
          <PageNodes snap={snap} page={page} editing={editingText} />
        </g>
      </svg>

      {topFrames.map((id) => {
        const n = nodes[id];
        const q = toScreen({ x: n.x, y: n.y });
        if (renaming === id) {
          return (
            <input
              key={id}
              className="frame-rename"
              autoFocus
              defaultValue={n.name}
              style={{ left: q.x, top: q.y - 22 }}
              onBlur={(e) => {
                if (e.target.value.trim()) updateNodes(props.doc, { [id]: { name: e.target.value.trim() } });
                setRenaming(null);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.nativeEvent.isComposing) return;
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setRenaming(null);
              }}
            />
          );
        }
        return (
          <div
            key={id}
            className={`frame-label${sel.includes(id) ? ' on' : ''}`}
            data-id={id}
            data-label=""
            style={{ left: q.x, top: q.y - 20, maxWidth: Math.max(24, n.w * zoom) }}
          >
            {displayName(n)}
          </div>
        );
      })}

      <svg className="overlay" width="100%" height="100%">
        {hover && !sel.includes(hover) && !dragKind && nodes[hover]?.page === page && outline(hover, BLUE, 1.5)}
        {dropTarget && outline(dropTarget, BLUE, 2, 'drop')}
        {props.others.map((o) =>
          o.selection.map((id) => nodes[id] && outline(id, o.color, 1.5, `${o.clientId}-${id}`)),
        )}
        {sel.map((id) => outline(id, BLUE, 1))}
        {guides.map((g, i) => {
          const a = toScreen({ x: g.x1, y: g.y1 });
          const b = toScreen({ x: g.x2, y: g.y2 });
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={GUIDE} strokeWidth={1} />;
        })}
        {marquee &&
          (() => {
            const a = toScreen({ x: marquee.x, y: marquee.y });
            return (
              <rect
                x={a.x}
                y={a.y}
                width={marquee.w * zoom}
                height={marquee.h * zoom}
                fill="rgba(13, 153, 255, 0.08)"
                stroke={BLUE}
              />
            );
          })()}
        {handles}
      </svg>

      {sizeLabel && editable && !editingText && (
        <div className="size-label" style={{ left: sizeLabel.x, top: sizeLabel.y }}>
          {sizeLabel.text}
        </div>
      )}

      {props.pins.map((pin) => {
        const q = toScreen(pin.pos);
        return (
          <button
            type="button"
            key={pin.threadId}
            data-pin={pin.threadId}
            className={`pin${pin.active ? ' on' : ''}`}
            style={{ left: q.x, top: q.y - 30 }}
            onClick={() => props.onPin(pin.threadId)}
            aria-label="댓글 열기"
          >
            {pin.label}
          </button>
        );
      })}

      {props.others.map(
        (o) =>
          o.cursor && (
            <div key={o.clientId} className="remote-cursor" style={{ ...toScreenStyle(toScreen(o.cursor)) }}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path d="M2 2l5.5 14 2-6 6-2z" fill={o.color} stroke="#fff" strokeWidth="1.2" />
              </svg>
              <span style={{ background: o.color }}>{o.name}</span>
            </div>
          ),
      )}

      {editing && (
        <TextEditor
          key={editing.id}
          node={editing}
          pos={toScreen(absPos(snap, editing.id))}
          zoom={zoom}
          onChange={(text) => {
            const size = measureText({ ...editing, text });
            updateNodes(props.doc, {
              [editing.id]: editing.textMode === 'auto' ? { text, w: size.w, h: size.h } : { text, h: size.h },
            });
          }}
          onDone={(text) => {
            props.onEditText(null);
            if (!text.trim()) {
              deleteNodes(props.doc, latest.current.snap, [editing.id]);
              props.onSelect([]);
            }
            props.onGestureEnd();
          }}
        />
      )}
    </CanvasWrap>
  );
};

const toScreenStyle = (q: Pt) => ({ left: q.x, top: q.y });

// 글 고치기: 요소 위에 같은 모양의 입력칸을 띄운다
const TextEditor: FC<{
  node: DNode;
  pos: Pt;
  zoom: number;
  onChange: (text: string) => void;
  onDone: (text: string) => void;
}> = ({ node, pos, zoom, onChange, onDone }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    // 누르기가 끝난 다음에 포커스를 준다
    const frame = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.select();
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <textarea
      ref={ref}
      className="text-editor"
      defaultValue={node.text}
      aria-label="글 고치기"
      spellCheck={false}
      style={{
        left: pos.x,
        top: pos.y,
        width: Math.max(node.w, 4) * zoom + node.fontSize * zoom,
        height: Math.max(node.h, node.fontSize * node.lineHeight) * zoom,
        fontFamily: FONT_FAMILY,
        fontSize: node.fontSize * zoom,
        fontWeight: node.fontWeight,
        lineHeight: node.lineHeight,
        color: node.fill || 'inherit',
        textAlign: node.align,
        whiteSpace: node.textMode === 'auto' ? 'pre' : 'pre-wrap',
        transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
        transformOrigin: `${(node.w * zoom) / 2}px ${(node.h * zoom) / 2}px`,
      }}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onDone(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
    />
  );
};

export default DesignCanvas;
