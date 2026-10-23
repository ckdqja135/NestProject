import {
  ChevronDown,
  ChevronRight,
  Circle,
  Eye,
  EyeOff,
  Frame,
  Lock,
  LockOpen,
  LucideIcon,
  Minus,
  MoveUpRight,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Square,
  Trash2,
  Type,
} from 'lucide-react';
import React, { FC, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import {
  addPage,
  childrenOf,
  deletePage,
  displayName,
  isAncestor,
  LayerSpot,
  moveInLayers,
  NodeType,
  pageKey,
  Snapshot,
  updateNodes,
  updatePage,
} from './model';
import { LayersWrap } from './styles';

const ICONS: Record<NodeType, LucideIcon> = {
  frame: Frame,
  rect: Square,
  ellipse: Circle,
  line: Minus,
  arrow: MoveUpRight,
  text: Type,
};

interface Props {
  doc: Y.Doc;
  snap: Snapshot;
  page: string;
  onPage: (id: string) => void;
  selection: string[];
  onSelect: (ids: string[]) => void;
  hover: string | null;
  onHover: (id: string | null) => void;
  editable: boolean;
  title: string;
  onTitle?: (title: string) => void;
  sidebarHidden: boolean;
  onToggleSidebar: () => void;
}

type Drop = { id: string; zone: 'above' | 'below' | 'inside' } | null;

const LayersPanel: FC<Props> = ({
  doc,
  snap,
  page,
  onPage,
  selection,
  onSelect,
  hover,
  onHover,
  editable,
  title,
  onTitle,
  sidebarHidden,
  onToggleSidebar,
}) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renamingPage, setRenamingPage] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 캔버스에서 고른 요소가 보이도록 위 프레임을 펼치고 그 줄로 옮겨 간다
  useEffect(() => {
    if (!selection.length) return;
    setCollapsed((prev) => {
      const next = { ...prev };
      let changed = false;
      selection.forEach((id) => {
        let parent = snap.nodes[id]?.parent;
        while (parent) {
          if (next[parent]) {
            delete next[parent];
            changed = true;
          }
          parent = snap.nodes[parent]?.parent ?? null;
        }
      });
      return changed ? next : prev;
    });
    requestAnimationFrame(() =>
      listRef.current?.querySelector(`[data-row="${selection[0]}"]`)?.scrollIntoView({ block: 'nearest' }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.join()]);

  const onRowClick = (e: React.MouseEvent, id: string) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      onSelect(selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id]);
    } else {
      onSelect([id]);
    }
  };

  const dropAt = (target: string, zone: 'above' | 'below' | 'inside') => {
    if (!dragId || dragId === target || isAncestor(snap, dragId, target)) return;
    const node = snap.nodes[target];
    if (zone === 'inside') {
      moveInLayers(doc, snap, dragId, target, page, 'top');
      return;
    }
    // 목록은 위가 앞(z 큼): 줄 위 = 그 요소보다 앞, 줄 아래 = 그 요소보다 뒤
    const spot: LayerSpot = zone === 'above' ? { above: target } : { below: target };
    moveInLayers(doc, snap, dragId, node.parent, page, spot);
  };

  const selectedAncestor = (id: string) => selection.some((s) => isAncestor(snap, s, id));

  const renderRows = (key: string, depth: number): React.ReactNode =>
    childrenOf(snap, key)
      .slice()
      .reverse()
      .map((id) => {
        const n = snap.nodes[id];
        const Icon = ICONS[n.type];
        const kids = childrenOf(snap, id);
        const open = !collapsed[id];
        const classes = [
          'row',
          selection.includes(id) ? 'on' : selectedAncestor(id) ? 'child-of-on' : '',
          hover === id ? 'hover-canvas' : '',
          !n.visible ? 'dim' : '',
          drop?.id === id ? `drop-${drop.zone}` : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <React.Fragment key={id}>
            <div
              className={classes}
              data-row={id}
              style={{ paddingLeft: 6 + depth * 14 }}
              draggable={editable && renaming !== id}
              onDragStart={(e) => {
                setDragId(id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setDrop(null);
              }}
              onDragOver={(e) => {
                if (!dragId || dragId === id || isAncestor(snap, dragId, id)) return;
                e.preventDefault();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const ratio = (e.clientY - rect.top) / rect.height;
                const zone =
                  n.type === 'frame' && ratio > 0.3 && ratio < 0.7 ? 'inside' : ratio < 0.5 ? 'above' : 'below';
                if (drop?.id !== id || drop.zone !== zone) setDrop({ id, zone });
              }}
              onDragLeave={() => setDrop((d) => (d?.id === id ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                if (drop) dropAt(drop.id, drop.zone);
                setDragId(null);
                setDrop(null);
              }}
              onClick={(e) => onRowClick(e, id)}
              onDoubleClick={() => editable && setRenaming(id)}
              onMouseEnter={() => onHover(id)}
              onMouseLeave={() => onHover(null)}
            >
              <span
                className="chev"
                onClick={(e) => {
                  e.stopPropagation();
                  if (kids.length) setCollapsed((c) => ({ ...c, [id]: open }));
                }}
              >
                {kids.length ? open ? <ChevronDown size={12} /> : <ChevronRight size={12} /> : null}
              </span>
              <Icon className="type" size={13} />
              {renaming === id ? (
                <input
                  autoFocus
                  defaultValue={displayName(n)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    updateNodes(doc, { [id]: { name: e.target.value.trim() } });
                    setRenaming(null);
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                />
              ) : (
                <span className={`name${n.type === 'frame' ? ' frame-name' : ''}`}>{displayName(n)}</span>
              )}
              {editable && (
                <span className={`toggles${n.locked || !n.visible ? ' stay' : ''}`}>
                  <button
                    type="button"
                    className="icon-btn"
                    title={n.locked ? '잠금 풀기' : '잠그기'}
                    aria-label={n.locked ? '잠금 풀기' : '잠그기'}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateNodes(doc, { [id]: { locked: !n.locked } });
                    }}
                  >
                    {n.locked ? <Lock size={12} /> : <LockOpen size={12} />}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title={n.visible ? '숨기기' : '보이기'}
                    aria-label={n.visible ? '숨기기' : '보이기'}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateNodes(doc, { [id]: { visible: !n.visible } });
                    }}
                  >
                    {n.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                </span>
              )}
            </div>
            {open && kids.length > 0 && renderRows(id, depth + 1)}
          </React.Fragment>
        );
      });

  const pageNodes = childrenOf(snap, pageKey(page));

  return (
    <LayersWrap>
      <div className="file">
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleSidebar}
          title={sidebarHidden ? 'Docs 목록 보이기' : 'Docs 목록 숨기기 (캔버스 넓게)'}
          aria-label={sidebarHidden ? 'Docs 목록 보이기' : 'Docs 목록 숨기기'}
        >
          {sidebarHidden ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
        <input
          value={title}
          readOnly={!onTitle}
          onChange={(e) => onTitle?.(e.target.value)}
          aria-label="파일 이름"
          maxLength={200}
        />
      </div>

      <div className="pages">
        <div className="section-title">
          <span className="grow">페이지</span>
          {editable && (
            <button
              type="button"
              className="icon-btn"
              title="페이지 더하기"
              aria-label="페이지 더하기"
              onClick={() => onPage(addPage(doc, `페이지 ${snap.pages.length + 1}`))}
            >
              <Plus size={14} />
            </button>
          )}
        </div>
        {snap.pages.map((p) => (
          <div
            key={p.id}
            className={`row page-row${p.id === page ? ' on' : ''}`}
            onClick={() => onPage(p.id)}
            onDoubleClick={() => editable && setRenamingPage(p.id)}
          >
            {renamingPage === p.id ? (
              <input
                autoFocus
                defaultValue={p.name}
                onBlur={(e) => {
                  if (e.target.value.trim()) updatePage(doc, p.id, { name: e.target.value.trim() });
                  setRenamingPage(null);
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setRenamingPage(null);
                }}
              />
            ) : (
              <span className="name">{p.name}</span>
            )}
            {editable && snap.pages.length > 1 && (
              <span className="toggles">
                <button
                  type="button"
                  className="icon-btn"
                  title="페이지 지우기 (⌘Z 로 되돌리기)"
                  aria-label={`${p.name} 지우기`}
                  onClick={(e) => {
                    e.stopPropagation();
                    const rest = snap.pages.filter((other) => other.id !== p.id);
                    deletePage(doc, snap, p.id);
                    if (p.id === page) onPage(rest[0].id);
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="section-title">레이어</div>
      <div className="layers" ref={listRef} onMouseLeave={() => onHover(null)}>
        {pageNodes.length ? (
          renderRows(pageKey(page), 0)
        ) : (
          <p className="empty">아래 도구 막대에서 프레임(F)이나 도형을 골라 캔버스에 그려 보세요.</p>
        )}
      </div>
    </LayersWrap>
  );
};

export default LayersPanel;
