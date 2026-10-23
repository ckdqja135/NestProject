import { css, Global } from '@emotion/react';
import useCollab from '@hooks/useCollab';
import { IUser } from '@typings/db';
import fetcher from '@utils/fetcher';
import { Circle, Frame, Hand, MessageCircle, Minus, MousePointer2, MoveUpRight, Square, Type } from 'lucide-react';
import React, { FC, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import useSWR from 'swr';
import * as Y from 'yjs';
import type { DocComment } from '../CommentsPanel';
import DesignCanvas, { clampZoom, PinView, Remote, Tool, View } from './DesignCanvas';
import Inspector, { AlignMode } from './Inspector';
import LayersPanel from './LayersPanel';
import {
  absPos,
  addNodes,
  Box,
  boundsOf,
  changedIds,
  childrenOf,
  CLIP_PREFIX,
  Clip,
  copyNodes,
  deleteNodes,
  displayName,
  DNode,
  intersects,
  isEmptyDesign,
  LOCAL,
  makeNode,
  measureText,
  pageKey,
  parentKeyOf,
  parseClip,
  parseDesignSeed,
  pasteNodes,
  pinPosition,
  Pt,
  readSnapshot,
  reorder,
  SEED,
  seedDesign,
  setPin,
  Snapshot,
  topLevelOf,
  topZ,
  toText,
  trackedTypes,
  unionBounds,
  updateNodes,
  wrapInFrame,
} from './model';
import { DesignWrap, Menu, Toolbar } from './styles';

export interface DesignApi {
  removePin: (threadId: string) => void;
  jumpTo: (threadId: string) => void;
}

interface Props {
  workspace: string;
  docId: number;
  me: IUser;
  readOnly: boolean;
  initialContent: string;
  dark: boolean;
  title: string;
  onTitle?: (title: string) => void;
  activeThread: string | null;
  draftThread: string | null;
  onComment: (threadId: string, quote: string) => void;
  onOpenThread: (threadId: string) => void;
  apiRef: React.MutableRefObject<DesignApi | null>;
}

const SNAPSHOT_DELAY_MS = 3000;
const SIDEBAR_KEY = 'shlack-design-hide-docs-sidebar';
const viewKey = (docId: number, page: string) => `shlack-design-view-${docId}-${page}`;
const pageStoreKey = (docId: number) => `shlack-design-page-${docId}`;

const readStore = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStore = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 저장하지 못해도 이번 화면에서는 그대로 쓴다
  }
};

const newThreadId = () => `th-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

const TOOLS: { tool: Tool; Icon: typeof Square; label: string; key: string; edit?: boolean }[] = [
  { tool: 'move', Icon: MousePointer2, label: '선택', key: 'V' },
  { tool: 'hand', Icon: Hand, label: '화면 이동', key: 'H' },
  { tool: 'frame', Icon: Frame, label: '프레임', key: 'F', edit: true },
  { tool: 'rect', Icon: Square, label: '사각형', key: 'R', edit: true },
  { tool: 'ellipse', Icon: Circle, label: '타원', key: 'O', edit: true },
  { tool: 'line', Icon: Minus, label: '선', key: 'L', edit: true },
  { tool: 'arrow', Icon: MoveUpRight, label: '화살표', key: '⇧L', edit: true },
  { tool: 'text', Icon: Type, label: '글', key: 'T', edit: true },
  { tool: 'comment', Icon: MessageCircle, label: '댓글', key: 'C', edit: true },
];

const fileName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) || '디자인';

const download = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

// 화면에 맞추기: 상자 전체가 보이게
const fitBox = (box: Box | null, size: { w: number; h: number }, maxZoom: number): View => {
  if (!box || !size.w) return { x: size.w / 2, y: size.h / 2, zoom: 1 };
  const zoom = clampZoom(Math.min((size.w - 120) / Math.max(box.w, 1), (size.h - 160) / Math.max(box.h, 1), maxZoom));
  return {
    zoom,
    x: (size.w - box.w * zoom) / 2 - box.x * zoom,
    y: (size.h - box.h * zoom) / 2 - box.y * zoom - 20,
  };
};

const DesignEditor: FC<Props> = ({
  workspace,
  docId,
  me,
  readOnly,
  initialContent,
  dark,
  title,
  onTitle,
  activeThread,
  draftThread,
  onComment,
  onOpenThread,
  apiRef,
}) => {
  const { provider, synced, canEdit, shouldSeed, status } = useCollab(workspace, docId, me);
  const editable = canEdit && !readOnly;
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [pageId, setPageId] = useState(() => readStore(pageStoreKey(docId)) || '');
  const [selection, setSelection] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>('move');
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [remotes, setRemotes] = useState<(Remote & { page: string })[]>([]);
  const [menu, setMenu] = useState<{ kind: 'context' | 'zoom'; x: number; y: number } | null>(null);
  const [hideSidebar, setHideSidebar] = useState(() => readStore(SIDEBAR_KEY) !== '0');
  const [height, setHeight] = useState<number | null>(null);
  // 좁은 화면에서 띄운 패널
  const [openPanel, setOpenPanel] = useState<'left' | 'right' | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const fittedRef = useRef<string | null>(null);
  const clipRef = useRef<Clip | null>(null);
  const cursorRef = useRef<Pt | null>(null);
  const cursorTimer = useRef(0);
  const initialRef = useRef(initialContent);

  const doc = provider?.doc ?? null;
  const page = snap?.pages.some((p) => p.id === pageId) ? pageId : snap?.pages[0]?.id || '';
  const defaultBg = dark ? '#1e1e1e' : '#f5f5f5';
  const bg = snap?.pages.find((p) => p.id === page)?.bg || defaultBg;

  // 화면 높이에 맞춘다 (문서 머리 아래 전부)
  useLayoutEffect(() => {
    const fit = () => {
      const top = rootRef.current?.getBoundingClientRect().top ?? 0;
      setHeight(Math.max(420, window.innerHeight - top));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // 공동 편집 상태 → 화면용 스냅숏
  useEffect(() => {
    if (!provider || !synced) return undefined;
    const ydoc = provider.doc;
    let current = readSnapshot(ydoc, null, null);
    setSnap(current);
    const nodes = ydoc.getMap('nodes');
    const pages = ydoc.getArray('pages');
    const pins = ydoc.getMap('pins');
    const onNodes = (events: Y.YEvent<Y.AbstractType<unknown>>[]) => {
      current = readSnapshot(ydoc, current, changedIds(events));
      setSnap(current);
    };
    const onOther = () => {
      current = readSnapshot(ydoc, current, new Set());
      setSnap(current);
    };
    nodes.observeDeep(onNodes);
    pages.observeDeep(onOther);
    pins.observe(onOther);
    return () => {
      nodes.unobserveDeep(onNodes);
      pages.unobserveDeep(onOther);
      pins.unobserve(onOther);
    };
  }, [provider, synced]);

  // 새 디자인: 서버가 맡긴 한 사람만 첫 페이지(또는 템플릿)를 넣는다
  useEffect(() => {
    if (!provider || !synced || !shouldSeed) return;
    if (isEmptyDesign(provider.doc)) seedDesign(provider.doc, parseDesignSeed(initialRef.current));
    provider.seeded();
  }, [provider, synced, shouldSeed]);

  // 검색·미리보기용 글 보내기
  useEffect(() => {
    if (!provider || !editable) return undefined;
    const ydoc = provider.doc;
    let timer = 0;
    const onUpdate = (_u: Uint8Array, origin: unknown) => {
      if (origin !== LOCAL && origin !== SEED) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => provider.sendSnapshot(toText(readSnapshot(ydoc, null, null))),
        origin === SEED ? 300 : SNAPSHOT_DELAY_MS,
      );
    };
    ydoc.on('update', onUpdate);
    return () => {
      ydoc.off('update', onUpdate);
      window.clearTimeout(timer);
    };
  }, [provider, editable]);

  const undo = useMemo(
    () =>
      provider
        ? new Y.UndoManager(trackedTypes(provider.doc), { trackedOrigins: new Set([LOCAL]), captureTimeout: 400 })
        : null,
    [provider],
  );
  useEffect(() => () => undo?.destroy(), [undo]);

  // 페이지를 열면 지난번 보던 곳, 처음이면 전체가 보이게
  useEffect(() => {
    // 캔버스가 아직 제자리를 잡지 못했으면(너무 좁으면) 기다린다
    if (!snap || !page || size.w < 200 || size.h < 200 || fittedRef.current === page) return;
    fittedRef.current = page;
    writeStore(pageStoreKey(docId), page);
    const saved = readStore(viewKey(docId, page));
    if (saved) {
      try {
        const v = JSON.parse(saved);
        if (typeof v?.zoom === 'number' && v.zoom >= 0.05) {
          setView(v);
          return;
        }
      } catch {
        // 아래에서 맞춘다
      }
    }
    setView(fitBox(unionBounds(snap, childrenOf(snap, pageKey(page))), size, 1));
  }, [snap, page, size, docId]);

  useEffect(() => {
    if (fittedRef.current !== page || !page) return undefined;
    const timer = window.setTimeout(() => writeStore(viewKey(docId, page), JSON.stringify(view)), 400);
    return () => window.clearTimeout(timer);
  }, [view, page, docId]);

  // 내 커서·고른 것을 다른 사람에게 알린다
  const publish = useCallback(() => {
    provider?.awareness.setLocalStateField('design', { page, cursor: cursorRef.current, selection });
  }, [provider, page, selection]);
  const publishRef = useRef(publish);
  publishRef.current = publish;
  useEffect(() => publish(), [publish]);
  const onCursor = useCallback((p: Pt | null) => {
    cursorRef.current = p;
    if (!cursorTimer.current) {
      cursorTimer.current = window.setTimeout(() => {
        cursorTimer.current = 0;
        publishRef.current();
      }, 40);
    }
  }, []);
  useEffect(() => () => window.clearTimeout(cursorTimer.current), []);

  useEffect(() => {
    if (!provider) return undefined;
    const aw = provider.awareness;
    const update = () => {
      const list: (Remote & { page: string })[] = [];
      aw.getStates().forEach((state, clientId) => {
        if (clientId === provider.doc.clientID || !state.user) return;
        const d = state.design || {};
        list.push({
          clientId,
          name: String(state.user.name || ''),
          color: String(state.user.color || '#888'),
          page: String(d.page || ''),
          cursor: d.cursor || null,
          selection: Array.isArray(d.selection) ? d.selection : [],
        });
      });
      setRemotes(list);
    };
    update();
    aw.on('change', update);
    return () => aw.off('change', update);
  }, [provider]);

  // 다른 사람이 지운 요소는 고른 것에서 뺀다
  useEffect(() => {
    if (!snap) return;
    const alive = selection.filter((id) => snap.nodes[id]);
    if (alive.length !== selection.length) setSelection(alive);
    if (editingText && !snap.nodes[editingText]) setEditingText(null);
  }, [snap, selection, editingText]);

  // ── 댓글 핀 ──
  const { data: comments } = useSWR<DocComment[]>(`/api/workspaces/${workspace}/docs/${docId}/comments`, fetcher);
  const threads = useMemo(() => {
    const map = new Map<string, { resolved: boolean; order: number }>();
    (comments || []).forEach((c) => {
      if (!map.has(c.threadId)) map.set(c.threadId, { resolved: c.resolved, order: map.size + 1 });
    });
    return map;
  }, [comments]);
  const pins: PinView[] = useMemo(() => {
    if (!snap) return [];
    return Object.keys(snap.pins)
      .filter((threadId) => {
        const pin = snap.pins[threadId];
        const thread = threads.get(threadId);
        return pin.page === page && (thread ? !thread.resolved : threadId === draftThread);
      })
      .map((threadId) => ({
        threadId,
        pos: pinPosition(snap, snap.pins[threadId]),
        label: threads.has(threadId) ? String(threads.get(threadId)?.order) : '+',
        active: threadId === activeThread,
      }));
  }, [snap, threads, page, draftThread, activeThread]);

  const centerOn = useCallback(
    (p: Pt) => setView((v) => ({ ...v, x: size.w / 2 - p.x * v.zoom, y: size.h / 2 - p.y * v.zoom })),
    [size],
  );

  const snapRef = useRef(snap);
  snapRef.current = snap;
  apiRef.current = {
    removePin: (threadId) => {
      if (doc && snapRef.current?.pins[threadId]) setPin(doc, threadId, null);
    },
    jumpTo: (threadId) => {
      const s = snapRef.current;
      const pin = s?.pins[threadId];
      if (!s || !pin) return;
      if (pin.page !== page) {
        fittedRef.current = pin.page;
        setPageId(pin.page);
      }
      centerOn(pinPosition(s, pin));
    },
  };

  useEffect(
    () => () => {
      apiRef.current = null;
    },
    [apiRef],
  );

  const onNewPin = (pos: Pt, anchor: string | null) => {
    if (!doc || !snap) return;
    const threadId = newThreadId();
    const base = anchor && snap.nodes[anchor] ? absPos(snap, anchor) : { x: 0, y: 0 };
    setPin(doc, threadId, {
      page,
      node: anchor && snap.nodes[anchor] ? anchor : null,
      x: pos.x - base.x,
      y: pos.y - base.y,
    });
    onComment(threadId, anchor && snap.nodes[anchor] ? displayName(snap.nodes[anchor]) : '캔버스');
  };

  // ── 동작 ──
  const selected = snap ? topLevelOf(snap, selection) : [];
  const gestureEnd = useCallback(() => undo?.stopCapturing(), [undo]);

  const zoomAround = (factor: number) =>
    setView((v) => {
      const zoom = clampZoom(v.zoom * factor);
      const cx = size.w / 2;
      const cy = size.h / 2;
      return { zoom, x: cx - ((cx - v.x) * zoom) / v.zoom, y: cy - ((cy - v.y) * zoom) / v.zoom };
    });
  const zoomTo = (zoom: number) => zoomAround(zoom / view.zoom);
  const zoomFit = () => snap && setView(fitBox(unionBounds(snap, childrenOf(snap, pageKey(page))), size, 8));
  const zoomSelection = () => {
    if (!snap || !selected.length) return zoomFit();
    setView(fitBox(unionBounds(snap, selected), size, 8));
    return undefined;
  };

  const remove = () => {
    if (!doc || !snap || !selected.length) return;
    deleteNodes(doc, snap, selected);
    setSelection([]);
  };

  const copy = () => {
    if (!snap || !selected.length) return null;
    const clip = copyNodes(snap, selected);
    clipRef.current = clip;
    return clip;
  };

  const paste = (clip: Clip | null, text?: string) => {
    if (!doc || !snap || !editable) return;
    const center = { x: (size.w / 2 - view.x) / view.zoom, y: (size.h / 2 - view.y) / view.zoom };
    if (!clip) {
      if (!text?.trim()) return;
      // 그냥 글을 붙이면 글 상자로
      const node = makeNode('text', {
        page,
        parent: null,
        z: topZ(snap, pageKey(page)),
        x: Math.round(center.x),
        y: Math.round(center.y),
        text: text.slice(0, 5000),
      });
      addNodes(doc, [{ ...node, ...measureText(node) }]);
      setSelection([node.id]);
      return;
    }
    const roots = clip.nodes.filter((n) => !n.parent || !clip.nodes.some((o) => o.id === n.parent));
    const box = roots.length
      ? roots.reduce(
          (b, n) => {
            const x2 = Math.max(b.x + b.w, n.x + Math.max(n.w, 0));
            const y2 = Math.max(b.y + b.h, n.y + Math.max(n.h, 0));
            const x = Math.min(b.x, n.x);
            const y = Math.min(b.y, n.y);
            return { x, y, w: x2 - x, h: y2 - y };
          },
          { x: roots[0].x, y: roots[0].y, w: 0, h: 0 },
        )
      : null;
    // 고른 프레임이 하나면 그 안에, 아니면 페이지에. 원래 자리가 안 보이면 화면 가운데에
    const single = selected.length === 1 ? snap.nodes[selected[0]] : null;
    const into = single?.type === 'frame' ? single.id : null;
    let offset = { x: 0, y: 0 };
    if (box) {
      const visible = {
        x: -view.x / view.zoom,
        y: -view.y / view.zoom,
        w: size.w / view.zoom,
        h: size.h / view.zoom,
      };
      if (into) {
        const fb = boundsOf(snap, into);
        const inside = box.x >= fb.x && box.y >= fb.y && box.x + box.w <= fb.x + fb.w && box.y + box.h <= fb.y + fb.h;
        if (!inside) offset = { x: fb.x + 20 - box.x, y: fb.y + 20 - box.y };
      } else if (!intersects(box, visible)) {
        offset = { x: center.x - box.w / 2 - box.x, y: center.y - box.h / 2 - box.y };
      }
    }
    const ids = pasteNodes(doc, snap, clip, page, into, offset);
    setSelection(ids);
    undo?.stopCapturing();
  };

  const duplicate = () => {
    if (!doc || !snap || !selected.length) return;
    const parent = snap.nodes[selected[0]].parent;
    const allTopFrames = !parent && selected.every((id) => snap.nodes[id].type === 'frame');
    const box = unionBounds(snap, selected);
    const offset = allTopFrames && box ? { x: box.w + 40, y: 0 } : { x: 16, y: 16 };
    const ids = pasteNodes(doc, snap, copyNodes(snap, selected), page, parent, offset);
    setSelection(ids);
    undo?.stopCapturing();
  };

  const nudge = (dx: number, dy: number) => {
    if (!doc || !snap) return;
    const changes: Record<string, Partial<DNode>> = {};
    selected.forEach((id) => {
      const n = snap.nodes[id];
      if (!n.locked) changes[id] = { x: n.x + dx, y: n.y + dy };
    });
    updateNodes(doc, changes);
  };

  const toggle = (key: 'visible' | 'locked') => {
    if (!doc || !snap || !selected.length) return;
    const value = !selected.every((id) => snap.nodes[id][key]);
    const changes: Record<string, Partial<DNode>> = {};
    selected.forEach((id) => {
      changes[id] = { [key]: value };
    });
    updateNodes(doc, changes);
    undo?.stopCapturing();
  };

  const selectAll = () => {
    if (!snap) return;
    const key = selected.length ? parentKeyOf(snap.nodes[selected[0]]) : pageKey(page);
    setSelection(childrenOf(snap, key).filter((id) => snap.nodes[id].visible && !snap.nodes[id].locked));
  };

  const frameSelection = () => {
    if (!doc || !snap || !selected.length) return;
    const id = wrapInFrame(doc, snap, selected, page);
    if (id) setSelection([id]);
    undo?.stopCapturing();
  };

  const align = (mode: AlignMode) => {
    if (!doc || !snap) return;
    const ids = selected.filter((id) => !snap.nodes[id].locked);
    if (!ids.length) return;
    let ref: Box | null;
    if (ids.length === 1) {
      const parent = snap.nodes[ids[0]].parent;
      if (!parent) return;
      ref = boundsOf(snap, parent);
    } else {
      ref = unionBounds(snap, ids);
    }
    if (!ref) return;
    const changes: Record<string, Partial<DNode>> = {};
    if (mode === 'hdist' || mode === 'vdist') {
      const horizontal = mode === 'hdist';
      const items = ids
        .map((id) => ({ id, b: boundsOf(snap, id) }))
        .sort((a, b) => (horizontal ? a.b.x - b.b.x : a.b.y - b.b.y));
      const total = items.reduce((sum, it) => sum + (horizontal ? it.b.w : it.b.h), 0);
      const gap = ((horizontal ? ref.w : ref.h) - total) / (items.length - 1);
      let cursor = horizontal ? ref.x : ref.y;
      items.forEach(({ id, b }) => {
        const n = snap.nodes[id];
        if (horizontal) changes[id] = { x: Math.round(n.x + cursor - b.x) };
        else changes[id] = { y: Math.round(n.y + cursor - b.y) };
        cursor += (horizontal ? b.w : b.h) + gap;
      });
    } else {
      const r = ref;
      ids.forEach((id) => {
        const n = snap.nodes[id];
        const b = boundsOf(snap, id);
        let dx = 0;
        let dy = 0;
        if (mode === 'left') dx = r.x - b.x;
        if (mode === 'hcenter') dx = r.x + r.w / 2 - (b.x + b.w / 2);
        if (mode === 'right') dx = r.x + r.w - (b.x + b.w);
        if (mode === 'top') dy = r.y - b.y;
        if (mode === 'vcenter') dy = r.y + r.h / 2 - (b.y + b.h / 2);
        if (mode === 'bottom') dy = r.y + r.h - (b.y + b.h);
        changes[id] = { x: Math.round(n.x + dx), y: Math.round(n.y + dy) };
      });
    }
    updateNodes(doc, changes);
    undo?.stopCapturing();
  };

  const addPreset = (preset: { name: string; w: number; h: number }) => {
    if (!doc || !snap) return;
    const top = childrenOf(snap, pageKey(page));
    const box = unionBounds(snap, top);
    const center = { x: (size.w / 2 - view.x) / view.zoom, y: (size.h / 2 - view.y) / view.zoom };
    // 이미 있는 것들 오른쪽에 둔다 (Figma 처럼)
    const x = box ? box.x + box.w + 100 : Math.round(center.x - preset.w / 2);
    const y = box ? box.y : Math.round(center.y - preset.h / 2);
    const node = makeNode('frame', {
      page,
      parent: null,
      z: topZ(snap, pageKey(page)),
      x,
      y,
      w: preset.w,
      h: preset.h,
      name: preset.name,
    });
    addNodes(doc, [node]);
    setSelection([node.id]);
    setTool('move');
    setView(fitBox({ x, y, w: preset.w, h: preset.h }, size, 1));
    undo?.stopCapturing();
  };

  const exportSelection = async (format: 'png' | 'svg', scale: number) => {
    const root = rootRef.current;
    if (!snap || !root) return;
    const ids = selected.length
      ? selected
      : childrenOf(snap, pageKey(page)).filter((id) => snap.nodes[id].type === 'frame');
    if (!ids.length) {
      toast.info('내보낼 프레임이나 요소를 골라 주세요.', { position: 'bottom-center' });
      return;
    }
    const NS = 'http://www.w3.org/2000/svg';
    // eslint-disable-next-line no-restricted-syntax
    for (const id of ids) {
      const n = snap.nodes[id];
      const el = root.querySelector(`.world [data-frame="${id}"]`) || root.querySelector(`.world [data-id="${id}"]`);
      if (!n || !el) continue;
      const b = boundsOf(snap, id);
      const parentAbs = n.parent ? absPos(snap, n.parent) : { x: 0, y: 0 };
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('xmlns', NS);
      svg.setAttribute('width', String(Math.ceil(b.w * (format === 'png' ? 1 : scale))));
      svg.setAttribute('height', String(Math.ceil(b.h * (format === 'png' ? 1 : scale))));
      svg.setAttribute('viewBox', `0 0 ${b.w} ${b.h}`);
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('transform', `translate(${parentAbs.x - b.x} ${parentAbs.y - b.y})`);
      g.appendChild(el.cloneNode(true));
      svg.appendChild(g);
      const text = new XMLSerializer().serializeToString(svg);
      const name = fileName(displayName(n));
      if (format === 'svg') {
        download(new Blob([text], { type: 'image/svg+xml' }), `${name}.svg`);
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.ceil(b.w * scale));
          canvas.height = Math.max(1, Math.ceil(b.h * scale));
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          try {
            canvas.toBlob((blob) => {
              if (blob) download(blob, `${name}${scale > 1 ? `@${scale}x` : ''}.png`);
              resolve();
            }, 'image/png');
          } catch {
            toast.error('PNG 로 만들지 못했어요. SVG 로 내보내 보세요.', { position: 'bottom-center' });
            resolve();
          }
        };
        img.onerror = () => {
          toast.error('그림을 만들지 못했어요.', { position: 'bottom-center' });
          resolve();
        };
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
      });
    }
  };

  const follow = (remote: Remote & { page?: string }) => {
    const target = remotes.find((r) => r.clientId === remote.clientId);
    if (!target) return;
    if (target.page && target.page !== page) {
      fittedRef.current = target.page;
      setPageId(target.page);
      setSelection([]);
    }
    if (target.cursor) centerOn(target.cursor);
  };

  const changePage = (id: string) => {
    if (id === page) return;
    setPageId(id);
    setSelection([]);
    setEditingText(null);
  };

  // ── 키보드 ──
  const onKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (e.nativeEvent.isComposing) return;
    const mod = e.metaKey || e.ctrlKey;
    const { code, shiftKey: shift, altKey: alt } = e;
    const handled = () => e.preventDefault();

    if (code === 'Space') {
      handled();
      if (!spaceDown) setSpaceDown(true);
      return;
    }
    if (mod && code === 'KeyZ') {
      handled();
      if (shift) undo?.redo();
      else undo?.undo();
      return;
    }
    if (mod && code === 'KeyY') {
      handled();
      undo?.redo();
      return;
    }
    if (mod && (code === 'Equal' || code === 'NumpadAdd')) {
      handled();
      zoomAround(2);
      return;
    }
    if (mod && (code === 'Minus' || code === 'NumpadSubtract')) {
      handled();
      zoomAround(0.5);
      return;
    }
    if (shift && !mod && code === 'Digit0') return zoomTo(1);
    if (shift && !mod && code === 'Digit1') return zoomFit();
    if (shift && !mod && code === 'Digit2') return zoomSelection();
    if (!mod && !shift && (code === 'Equal' || code === 'NumpadAdd')) return zoomAround(2);
    if (!mod && !shift && (code === 'Minus' || code === 'NumpadSubtract')) return zoomAround(0.5);
    if (mod && code === 'KeyA') {
      handled();
      selectAll();
      return;
    }
    if (code === 'Escape') {
      if (menu) setMenu(null);
      else if (tool !== 'move') setTool('move');
      else setSelection([]);
      return;
    }
    if (!editable) {
      if (!mod && code === 'KeyV') setTool('move');
      if (!mod && code === 'KeyH') setTool('hand');
      return;
    }
    if (code === 'Backspace' || code === 'Delete') {
      handled();
      remove();
      return;
    }
    if (mod && code === 'KeyD') {
      handled();
      duplicate();
      return;
    }
    if (mod && code === 'KeyG') {
      handled();
      frameSelection();
      return;
    }
    if (mod && shift && code === 'KeyH') {
      handled();
      toggle('visible');
      return;
    }
    if (mod && shift && code === 'KeyL') {
      handled();
      toggle('locked');
      return;
    }
    if (code === 'BracketRight' || code === 'BracketLeft') {
      if (!doc || !snap || !selected.length) return;
      handled();
      const front = code === 'BracketRight';
      reorder(doc, snap, selected, mod ? (front ? 'forward' : 'backward') : front ? 'front' : 'back');
      undo?.stopCapturing();
      return;
    }
    if (code.startsWith('Arrow') && selected.length) {
      handled();
      const step = shift ? 10 : 1;
      if (code === 'ArrowLeft') nudge(-step, 0);
      if (code === 'ArrowRight') nudge(step, 0);
      if (code === 'ArrowUp') nudge(0, -step);
      if (code === 'ArrowDown') nudge(0, step);
      return;
    }
    if (code === 'Enter' && snap && selected.length === 1) {
      handled();
      const n = snap.nodes[selected[0]];
      if (shift) {
        if (n.parent) setSelection([n.parent]);
      } else if (n.type === 'text') {
        setEditingText(n.id);
      } else if (n.type === 'frame') {
        const kids = childrenOf(snap, n.id);
        if (kids.length) setSelection(kids);
      }
      return;
    }
    if (mod || alt) return;
    const tools: Record<string, Tool> = {
      KeyV: 'move',
      KeyH: 'hand',
      KeyF: 'frame',
      KeyA: 'frame',
      KeyR: 'rect',
      KeyO: 'ellipse',
      KeyL: shift ? 'arrow' : 'line',
      KeyT: 'text',
      KeyC: 'comment',
    };
    if (tools[code]) {
      handled();
      setTool(tools[code]);
    }
  };

  const onKeyUp = (e: React.KeyboardEvent) => {
    if (e.code === 'Space') setSpaceDown(false);
  };

  const isField = (e: React.ClipboardEvent) =>
    !!(e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]');

  const onCopy = (e: React.ClipboardEvent) => {
    if (isField(e)) return;
    const clip = copy();
    if (!clip) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', CLIP_PREFIX + JSON.stringify(clip));
  };
  const onCut = (e: React.ClipboardEvent) => {
    if (isField(e) || !editable) return;
    onCopy(e);
    remove();
  };
  const onPaste = (e: React.ClipboardEvent) => {
    if (isField(e) || !editable) return;
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    paste(parseClip(text), text);
  };

  // 메뉴 바깥을 누르면 닫는다
  useEffect(() => {
    if (!menu) return undefined;
    const close = (e: PointerEvent) => {
      if (!(e.target as Element).closest('[data-design-menu]')) setMenu(null);
    };
    window.addEventListener('pointerdown', close, true);
    return () => window.removeEventListener('pointerdown', close, true);
  }, [menu]);

  const run = (fn: () => void) => () => {
    fn();
    setMenu(null);
    rootRef.current?.querySelector<HTMLElement>('[aria-label="디자인 캔버스"]')?.focus({ preventScroll: true });
  };

  const others = remotes.filter((r) => r.page === page);
  const people = useMemo(
    () => remotes.map((r) => ({ ...r, cursor: r.cursor })),
    // 사람이 바뀔 때만 (커서가 움직일 때마다 다시 그리지 않게)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [remotes.map((r) => `${r.clientId}:${r.name}`).join()],
  );

  const message =
    status === 'error'
      ? '이 디자인을 열 수 없습니다.'
      : status === 'offline'
      ? '연결이 끊겼습니다. 다시 연결하는 중… (고친 내용은 연결되면 합쳐집니다)'
      : !snap
      ? '불러오는 중…'
      : !snap.pages.length
      ? '처음 화면을 준비하는 중…'
      : null;

  const selectedNodes = snap ? selected.map((id) => snap.nodes[id]) : [];
  const allHidden = selectedNodes.length > 0 && selectedNodes.every((n) => !n.visible);
  const allLocked = selectedNodes.length > 0 && selectedNodes.every((n) => n.locked);

  return (
    <DesignWrap
      ref={rootRef}
      style={height ? { height } : undefined}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setSpaceDown(false);
      }}
      onCopy={onCopy}
      onCut={onCut}
      onPaste={onPaste}
      aria-label="디자인"
    >
      {hideSidebar && (
        <Global
          styles={css`
            nav[aria-label='Docs 메뉴'] {
              display: none !important;
            }
          `}
        />
      )}
      <aside className={`panel left${openPanel === 'left' ? ' open' : ''}`} aria-label="페이지와 레이어">
        {snap && doc && (
          <LayersPanel
            doc={doc}
            snap={snap}
            page={page}
            onPage={changePage}
            selection={selection}
            onSelect={setSelection}
            hover={hover}
            onHover={setHover}
            editable={editable}
            title={title}
            onTitle={onTitle}
            sidebarHidden={hideSidebar}
            onToggleSidebar={() => {
              writeStore(SIDEBAR_KEY, hideSidebar ? '0' : '1');
              setHideSidebar(!hideSidebar);
            }}
          />
        )}
      </aside>

      <div className="stage" onPointerDownCapture={() => openPanel && setOpenPanel(null)}>
        {snap && doc && page && (
          <DesignCanvas
            doc={doc}
            snap={snap}
            page={page}
            bg={bg}
            editable={editable}
            tool={tool}
            onTool={setTool}
            selection={selection}
            onSelect={setSelection}
            view={view}
            onView={setView}
            onSize={setSize}
            hover={hover}
            onHover={setHover}
            editingText={editingText}
            onEditText={setEditingText}
            others={others}
            pins={pins}
            onPin={onOpenThread}
            onNewPin={onNewPin}
            onCursor={onCursor}
            onContextMenu={(p) => setMenu({ kind: 'context', x: p.x, y: p.y })}
            onGestureEnd={gestureEnd}
            spaceDown={spaceDown}
          />
        )}
        <div className="panel-toggles">
          <button
            type="button"
            onClick={() => setOpenPanel(openPanel === 'left' ? null : 'left')}
            aria-pressed={openPanel === 'left'}
          >
            레이어
          </button>
          <button
            type="button"
            onClick={() => setOpenPanel(openPanel === 'right' ? null : 'right')}
            aria-pressed={openPanel === 'right'}
          >
            속성
          </button>
        </div>
        {message && (
          <div className="status-pill" role="status">
            {message}
          </div>
        )}
        <Toolbar role="toolbar" aria-label="도구">
          {TOOLS.filter((t) => editable || !t.edit).map((t, i) => (
            <React.Fragment key={t.tool}>
              {(i === 2 || t.tool === 'comment') && editable && <span className="sep" />}
              <button
                type="button"
                className={tool === t.tool ? 'on' : undefined}
                onClick={() => setTool(t.tool)}
                title={`${t.label} (${t.key})`}
                aria-label={t.label}
                aria-pressed={tool === t.tool}
              >
                <t.Icon size={17} />
              </button>
            </React.Fragment>
          ))}
        </Toolbar>
      </div>

      <aside className={`panel right${openPanel === 'right' ? ' open' : ''}`} aria-label="속성">
        {snap && doc && (
          <Inspector
            doc={doc}
            snap={snap}
            page={page}
            defaultBg={defaultBg}
            selection={selection}
            editable={editable}
            frameTool={tool === 'frame'}
            zoom={view.zoom}
            others={people}
            onFollow={follow}
            onZoomMenu={(rect) => setMenu({ kind: 'zoom', x: rect.left, y: rect.bottom + 4 })}
            onPreset={addPreset}
            onAlign={align}
            onExport={exportSelection}
          />
        )}
      </aside>

      {menu?.kind === 'zoom' && (
        <Menu data-design-menu="" role="menu" style={{ left: Math.min(menu.x, window.innerWidth - 220), top: menu.y }}>
          <button type="button" role="menuitem" onClick={run(() => zoomAround(2))}>
            확대 <kbd>⌘+</kbd>
          </button>
          <button type="button" role="menuitem" onClick={run(() => zoomAround(0.5))}>
            축소 <kbd>⌘−</kbd>
          </button>
          <hr />
          <button type="button" role="menuitem" onClick={run(zoomFit)}>
            전체 보기 <kbd>⇧1</kbd>
          </button>
          <button type="button" role="menuitem" disabled={!selected.length} onClick={run(zoomSelection)}>
            고른 것 보기 <kbd>⇧2</kbd>
          </button>
          <button type="button" role="menuitem" onClick={run(() => zoomTo(1))}>
            100% <kbd>⇧0</kbd>
          </button>
        </Menu>
      )}

      {menu?.kind === 'context' && (
        <Menu
          data-design-menu=""
          role="menu"
          style={{ left: Math.min(menu.x, window.innerWidth - 220), top: Math.min(menu.y, window.innerHeight - 380) }}
        >
          <button type="button" role="menuitem" disabled={!selected.length} onClick={run(() => copy())}>
            복사 <kbd>⌘C</kbd>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!editable || !clipRef.current}
            onClick={run(() => paste(clipRef.current))}
          >
            붙여넣기 <kbd>⌘V</kbd>
          </button>
          <button type="button" role="menuitem" disabled={!editable || !selected.length} onClick={run(duplicate)}>
            복제 <kbd>⌘D</kbd>
          </button>
          <button type="button" role="menuitem" disabled={!editable || !selected.length} onClick={run(remove)}>
            지우기 <kbd>⌫</kbd>
          </button>
          <hr />
          {(
            [
              ['front', '맨 앞으로', ']'],
              ['forward', '앞으로', '⌘]'],
              ['backward', '뒤로', '⌘['],
              ['back', '맨 뒤로', '['],
            ] as const
          ).map(([mode, label, key]) => (
            <button
              key={mode}
              type="button"
              role="menuitem"
              disabled={!editable || !selected.length}
              onClick={run(() => {
                if (doc && snap) reorder(doc, snap, selected, mode);
                undo?.stopCapturing();
              })}
            >
              {label} <kbd>{key}</kbd>
            </button>
          ))}
          <hr />
          <button type="button" role="menuitem" disabled={!editable || !selected.length} onClick={run(frameSelection)}>
            프레임으로 묶기 <kbd>⌘G</kbd>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!editable || !selected.length}
            onClick={run(() => toggle('visible'))}
          >
            {allHidden ? '보이기' : '숨기기'} <kbd>⇧⌘H</kbd>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!editable || !selected.length}
            onClick={run(() => toggle('locked'))}
          >
            {allLocked ? '잠금 풀기' : '잠그기'} <kbd>⇧⌘L</kbd>
          </button>
          <hr />
          <button type="button" role="menuitem" disabled={!selected.length} onClick={run(zoomSelection)}>
            고른 것 보기 <kbd>⇧2</kbd>
          </button>
        </Menu>
      )}
    </DesignWrap>
  );
};

export default DesignEditor;
