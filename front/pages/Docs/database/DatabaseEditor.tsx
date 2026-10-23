import useCollab from '@hooks/useCollab';
import { IUser } from '@typings/db';
import fetcher from '@utils/fetcher';
import {
  CalendarDays,
  Ellipsis,
  Eye,
  LayoutGrid,
  LucideIcon,
  Plus,
  Search,
  SquareKanban,
  Table2,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import React, { FC, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import useSWR from 'swr';
import { useLocation } from 'react-router-dom';
import { Transaction } from 'yjs';
import {
  applyView,
  CellValue,
  db,
  defaultSeed,
  isEmpty,
  parseDatabaseSeed,
  readDatabase,
  seedDatabase,
  toMarkdown,
  View,
  VIEW_LABELS,
  ViewType,
} from './model';
import { BoardView, CalendarView, GalleryView } from './OtherViews';
import RowPanel from './RowPanel';
import { DatabaseWrap } from './styles';
import TableView from './TableView';

const VIEW_ICONS: Record<ViewType, LucideIcon> = {
  table: Table2,
  board: SquareKanban,
  calendar: CalendarDays,
  gallery: LayoutGrid,
};
const SNAPSHOT_DELAY_MS = 2500;

const viewKey = (docId: number) => `shlack-db-view-${docId}`;
const readViewId = (docId: number) => {
  try {
    return localStorage.getItem(viewKey(docId));
  } catch {
    return null;
  }
};

interface Props {
  workspace: string;
  docId: number;
  me: IUser;
  readOnly: boolean;
  initialContent: string;
}

// 데이터베이스: 표·보드·캘린더·갤러리 보기 (실시간 동시 편집)
const DatabaseEditor: FC<Props> = ({ workspace, docId, me, readOnly, initialContent }) => {
  const { provider, synced, canEdit, shouldSeed, status } = useCollab(workspace, docId, me);
  const { data: members = [] } = useSWR<IUser[]>(`/api/workspaces/${workspace}/members`, fetcher);
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const [viewId, setViewId] = useState<string | null>(() => readViewId(docId));
  const [search, setSearch] = useState('');
  const [openRow, setOpenRow] = useState<string | null>(null);
  // 링크에 ?row= 가 있으면 그 항목을 열어 준다 (채팅에서 만든 할 일 링크)
  const location = useLocation();
  const linkedRow = useMemo(() => new URLSearchParams(location.search).get('row'), [location.search]);
  const openedLinkRef = useRef<string | null>(null);
  const [menu, setMenu] = useState<'add-view' | 'view' | null>(null);
  const [viewName, setViewName] = useState('');
  const snapshotTimer = useRef<number | null>(null);
  const editable = canEdit && !readOnly;
  const people = useMemo(() => members.filter((m) => !m.bot), [members]);
  const names = useMemo(() => Object.fromEntries(people.map((m) => [m.id, m.nickname])), [people]);
  const namesRef = useRef(names);
  namesRef.current = names;

  // 누가 고치든 다시 그린다. 내가 고친 것이면 검색·미리보기용 표도 보낸다
  useEffect(() => {
    if (!provider) return undefined;
    const onUpdate = (_u: Uint8Array, _o: unknown, doc: unknown, tr: Transaction) => {
      bump();
      if (!tr.local) return;
      if (snapshotTimer.current) window.clearTimeout(snapshotTimer.current);
      snapshotTimer.current = window.setTimeout(
        () => provider.sendSnapshot(toMarkdown(readDatabase(provider.doc), namesRef.current)),
        SNAPSHOT_DELAY_MS,
      );
    };
    provider.doc.on('update', onUpdate);
    return () => {
      provider.doc.off('update', onUpdate);
      if (snapshotTimer.current) window.clearTimeout(snapshotTimer.current);
    };
  }, [provider]);

  // 새 데이터베이스: 서버가 맡긴 한 사람만 기본 칸(또는 템플릿)을 넣는다
  useEffect(() => {
    if (!provider || !synced || !shouldSeed) return;
    if (isEmpty(provider.doc)) {
      seedDatabase(provider.doc, parseDatabaseSeed(initialContent) || defaultSeed(), me.id);
    }
    provider.seeded();
  }, [provider, synced, shouldSeed, initialContent, me.id]);

  const state = useMemo(
    () => (provider && synced ? readDatabase(provider.doc) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [provider, synced, version],
  );
  const view: View | undefined = state?.views.find((v) => v.id === viewId) || state?.views[0];
  const rows = useMemo(
    () => (state && view ? applyView(state, view, search, me.id, names) : []),
    [state, view, search, me.id, names],
  );

  const selectView = (id: string) => {
    setViewId(id);
    try {
      localStorage.setItem(viewKey(docId), id);
    } catch {
      // 저장하지 못해도 이번 화면에서는 바뀐다
    }
  };

  const doc = provider?.doc;
  const onCell = useCallback(
    (rowId: string, propId: string, value: CellValue) => doc && db.setCell(doc, rowId, propId, value),
    [doc],
  );
  const onOptions = useCallback(
    (propId: string, options: { id: string; name: string; color: string }[]) =>
      doc && db.updateProperty(doc, propId, { options }),
    [doc],
  );
  const onAddRow = (values: Record<string, CellValue> = {}) => {
    if (!doc || !view) return;
    const id = db.addRow(doc, values, me.id);
    if (view.type !== 'table') setOpenRow(id);
  };
  const onUpdateView = (changes: Partial<View>) => doc && view && db.updateView(doc, view.id, changes);

  if (!state || !view || !doc) {
    return (
      <DatabaseWrap>
        <div className="db-status" role="status">
          {status === 'error'
            ? '이 데이터베이스를 열 수 없습니다.'
            : status === 'offline'
            ? '연결이 끊겼습니다. 다시 연결하는 중…'
            : '불러오는 중…'}
        </div>
      </DatabaseWrap>
    );
  }
  if (!state.properties.length) {
    return (
      <DatabaseWrap>
        <div className="db-status" role="status">
          처음 칸을 준비하는 중…
        </div>
      </DatabaseWrap>
    );
  }

  const personProp = state.properties.find((p) => p.type === 'person');
  const mineOnly = !!view.filters?.some((f) => f.op === 'me');
  const toggleMine = () =>
    onUpdateView({
      filters: mineOnly
        ? (view.filters || []).filter((f) => f.op !== 'me')
        : [...(view.filters || []), { prop: personProp!.id, op: 'me' }],
    });
  if (linkedRow && openedLinkRef.current !== linkedRow && state.rows.some((r) => r.id === linkedRow)) {
    openedLinkRef.current = linkedRow;
    window.setTimeout(() => setOpenRow(linkedRow), 0);
  }
  const opened = openRow ? state.rows.find((r) => r.id === openRow) : undefined;
  const viewProps = {
    state,
    view,
    rows,
    members: people,
    editable,
    onCell,
    onOptions,
    onOpenRow: setOpenRow,
    onAddRow,
    onUpdateView,
  };

  return (
    <DatabaseWrap>
      {status === 'offline' && (
        <div className="db-status floating" role="status">
          연결이 끊겼습니다. 다시 연결하는 중… (고친 내용은 연결되면 합쳐집니다)
        </div>
      )}
      <div className="db-bar">
        <div className="tabs" role="tablist" aria-label="보기">
          {state.views.map((v) => {
            const Icon = VIEW_ICONS[v.type] || Table2;
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={v.id === view.id}
                className={v.id === view.id ? 'on' : undefined}
                onClick={() => selectView(v.id)}
              >
                <Icon size={14} /> {v.name}
              </button>
            );
          })}
          {editable && (
            <span className="menu-anchor">
              <button
                type="button"
                className="add-view"
                onClick={() => setMenu(menu === 'add-view' ? null : 'add-view')}
                aria-label="보기 더하기"
                title="보기 더하기"
              >
                <Plus size={14} />
              </button>
              {menu === 'add-view' && (
                <div className="menu" role="menu">
                  {(Object.keys(VIEW_LABELS) as ViewType[]).map((type) => {
                    const Icon = VIEW_ICONS[type];
                    return (
                      <button
                        key={type}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          const id = db.addView(doc, { name: VIEW_LABELS[type], type });
                          selectView(id);
                          setMenu(null);
                        }}
                      >
                        <Icon size={14} /> {VIEW_LABELS[type]}
                      </button>
                    );
                  })}
                </div>
              )}
            </span>
          )}
        </div>
        <div className="tools">
          {personProp && (
            <button
              type="button"
              className={mineOnly ? 'on' : undefined}
              onClick={editable ? toggleMine : undefined}
              disabled={!editable}
              aria-pressed={mineOnly}
              title={`${personProp.name}이(가) 나인 항목만`}
            >
              <UserCheck size={14} /> 내 담당만
            </button>
          )}
          {!!view.sorts?.length && editable && (
            <button type="button" className="chip" onClick={() => onUpdateView({ sorts: [] })} title="정렬 없애기">
              정렬: {state.properties.find((p) => p.id === view.sorts?.[0].prop)?.name}
              {view.sorts[0].dir === 'asc' ? ' ↑' : ' ↓'} <X size={12} />
            </button>
          )}
          <div className="search">
            <Search size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="찾기"
              aria-label="항목 찾기"
            />
          </div>
          {editable && (
            <span className="menu-anchor">
              <button
                type="button"
                onClick={() => {
                  setViewName(view.name);
                  setMenu(menu === 'view' ? null : 'view');
                }}
                aria-label="보기 설정"
                title="보기 설정"
              >
                <Ellipsis size={16} />
              </button>
              {menu === 'view' && (
                <div className="menu right" role="menu">
                  <input
                    value={viewName}
                    onChange={(e) => setViewName(e.target.value)}
                    onBlur={() => viewName.trim() && onUpdateView({ name: viewName.trim() })}
                    onKeyDown={(e) => !e.nativeEvent.isComposing && e.key === 'Enter' && setMenu(null)}
                    aria-label="보기 이름"
                  />
                  {!!view.hidden?.length && (
                    <button type="button" role="menuitem" onClick={() => onUpdateView({ hidden: [] })}>
                      <Eye size={14} /> 숨긴 칸 다시 보이기 ({view.hidden.length})
                    </button>
                  )}
                  {state.views.length > 1 && (
                    <button
                      type="button"
                      role="menuitem"
                      className="danger"
                      onClick={() => {
                        db.deleteView(doc, view.id);
                        setMenu(null);
                      }}
                    >
                      <Trash2 size={14} /> 이 보기 지우기
                    </button>
                  )}
                </div>
              )}
            </span>
          )}
          {editable && (
            <button type="button" className="primary" onClick={() => onAddRow()}>
              <Plus size={14} /> 새 항목
            </button>
          )}
        </div>
      </div>

      <div className="db-body">
        {view.type === 'table' && (
          <TableView
            {...viewProps}
            onAddProperty={() => db.addProperty(doc, { name: '새 칸', type: 'text' })}
            onUpdateProperty={(propId, changes) => db.updateProperty(doc, propId, changes)}
            onDeleteProperty={(propId) => db.deleteProperty(doc, propId)}
          />
        )}
        {view.type === 'board' && (
          <BoardView {...viewProps} onMoveRow={(rowId, beforeId) => db.moveRow(doc, rowId, beforeId)} />
        )}
        {view.type === 'calendar' && <CalendarView {...viewProps} />}
        {view.type === 'gallery' && <GalleryView {...viewProps} />}
      </div>

      {opened && (
        <RowPanel
          row={opened}
          properties={state.properties}
          members={people}
          editable={editable}
          onCell={(propId, value) => onCell(opened.id, propId, value)}
          onOptions={onOptions}
          onDelete={() => {
            db.deleteRow(doc, opened.id);
            setOpenRow(null);
          }}
          onClose={() => setOpenRow(null)}
        />
      )}
    </DatabaseWrap>
  );
};

export default DatabaseEditor;
