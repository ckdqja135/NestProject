import dayjs, { Dayjs } from 'dayjs';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import React, { FC, useMemo, useState } from 'react';
import { CellView, optionStyle } from './Cell';
import { Property, Row } from './model';
import { ViewProps } from './TableView';

const titleOf = (props: Property[], row: Row) => {
  const title = props.find((p) => p.type === 'title');
  return (title && String(row.values[title.id] || '')) || '제목 없음';
};

// 카드에 보여 줄 속성 (이름·묶는 칸·숨긴 칸 빼고, 값이 있는 것만)
const CardProps: FC<{ props: Property[]; row: Row; skip: string[]; members: ViewProps['members'] }> = ({
  props,
  row,
  skip,
  members,
}) => (
  <div className="card-props">
    {props
      .filter((p) => p.type !== 'title' && !skip.includes(p.id))
      .map((p) => {
        const value = row.values[p.id];
        if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) {
          return null;
        }
        return (
          <div key={p.id} className="card-prop" title={p.name}>
            <CellView prop={p} value={value} members={members} />
          </div>
        );
      })}
  </div>
);

const NONE = '__none__';

// 보드 보기: 상태·선택 칸 값으로 열을 나누고, 카드를 끌어 옮기면 값이 바뀐다
export const BoardView: FC<ViewProps & { onMoveRow: (rowId: string, beforeId: string | null) => void }> = ({
  state,
  view,
  rows,
  members,
  editable,
  onCell,
  onOpenRow,
  onAddRow,
  onUpdateView,
  onMoveRow,
}) => {
  const groupable = state.properties.filter((p) => p.type === 'status' || p.type === 'select');
  const group = groupable.find((p) => p.id === view.groupBy) || groupable[0];
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  if (!group) {
    return <p className="empty">보드로 보려면 상태나 선택 칸이 하나 있어야 합니다.</p>;
  }
  const hidden = view.hidden || [];
  const columns = [
    ...(group.options || []).map((o) => ({ id: o.id, name: o.name, color: o.color })),
    { id: NONE, name: `${group.name} 없음`, color: 'gray' },
  ];
  const valueOf = (row: Row) => {
    const v = row.values[group.id];
    return typeof v === 'string' && group.options?.some((o) => o.id === v) ? v : NONE;
  };
  const drop = (columnId: string, beforeId: string | null) => {
    if (!dragId) return;
    onCell(dragId, group.id, columnId === NONE ? null : columnId);
    if (beforeId !== dragId) onMoveRow(dragId, beforeId);
    setDragId(null);
    setOver(null);
  };
  return (
    <div className="board-view">
      {groupable.length > 1 && (
        <label className="group-by">
          묶는 칸
          <select value={group.id} onChange={(e) => onUpdateView({ groupBy: e.target.value })} aria-label="묶는 칸">
            {groupable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="columns">
        {columns.map((col) => {
          const cards = rows.filter((r) => valueOf(r) === col.id);
          return (
            <section
              key={col.id}
              className={`column${over === col.id ? ' over' : ''}`}
              aria-label={col.name}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setOver(col.id);
              }}
              onDragLeave={() => setOver((o) => (o === col.id ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                drop(col.id, null);
              }}
            >
              <header>
                <span className="pill" style={optionStyle(col.color)}>
                  {col.name}
                </span>
                <small>{cards.length}</small>
              </header>
              {cards.map((row) => (
                <article
                  key={row.id}
                  className={`card${dragId === row.id ? ' dragging' : ''}`}
                  data-row={row.id}
                  draggable={editable}
                  onDragStart={(e) => {
                    setDragId(row.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOver(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    drop(col.id, row.id);
                  }}
                  onClick={() => onOpenRow(row.id)}
                >
                  <b>{titleOf(state.properties, row)}</b>
                  <CardProps props={state.properties} row={row} skip={[group.id, ...hidden]} members={members} />
                </article>
              ))}
              {editable && (
                <button
                  type="button"
                  className="add-card"
                  onClick={() => onAddRow(col.id === NONE ? {} : { [group.id]: col.id })}
                >
                  <Plus size={14} /> 새 항목
                </button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 캘린더 보기: 날짜 칸 값으로 달력에 놓고, 끌어서 날짜를 바꾼다
export const CalendarView: FC<ViewProps> = ({
  state,
  view,
  rows,
  editable,
  onCell,
  onOpenRow,
  onAddRow,
  onUpdateView,
}) => {
  const dateProps = state.properties.filter((p) => p.type === 'date');
  const dateProp = dateProps.find((p) => p.id === view.dateProp) || dateProps[0];
  const [cursor, setCursor] = useState<Dayjs>(() => dayjs().startOf('month'));
  const [dragId, setDragId] = useState<string | null>(null);
  const days = useMemo(() => {
    const start = cursor.startOf('month').subtract(cursor.startOf('month').day(), 'day');
    return Array.from({ length: 42 }, (_, i) => start.add(i, 'day'));
  }, [cursor]);
  if (!dateProp) {
    return <p className="empty">캘린더로 보려면 날짜 칸이 하나 있어야 합니다.</p>;
  }
  const byDay = new Map<string, Row[]>();
  rows.forEach((r) => {
    const v = r.values[dateProp.id];
    if (typeof v === 'string' && v) byDay.set(v, [...(byDay.get(v) || []), r]);
  });
  const noDate = rows.filter((r) => !r.values[dateProp.id]);
  const today = dayjs().format('YYYY-MM-DD');
  return (
    <div className="calendar-view">
      <div className="cal-bar">
        <button type="button" onClick={() => setCursor(cursor.subtract(1, 'month'))} aria-label="이전 달">
          <ChevronLeft size={16} />
        </button>
        <strong>{cursor.format('YYYY년 M월')}</strong>
        <button type="button" onClick={() => setCursor(cursor.add(1, 'month'))} aria-label="다음 달">
          <ChevronRight size={16} />
        </button>
        <button type="button" onClick={() => setCursor(dayjs().startOf('month'))}>
          오늘
        </button>
        {dateProps.length > 1 && (
          <select value={dateProp.id} onChange={(e) => onUpdateView({ dateProp: e.target.value })} aria-label="날짜 칸">
            {dateProps.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        {noDate.length > 0 && <small className="nodate">날짜 없는 항목 {noDate.length}개</small>}
      </div>
      <div className="cal-grid">
        {WEEKDAYS.map((d) => (
          <div key={d} className="wd">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const key = day.format('YYYY-MM-DD');
          return (
            <div
              key={key}
              className={`day${day.month() !== cursor.month() ? ' other' : ''}${key === today ? ' today' : ''}`}
              data-day={key}
              onDragOver={(e) => dragId && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) onCell(dragId, dateProp.id, key);
                setDragId(null);
              }}
            >
              <span className="num">{day.date()}</span>
              {(byDay.get(key) || []).map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="event"
                  data-row={row.id}
                  draggable={editable}
                  onDragStart={() => setDragId(row.id)}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => onOpenRow(row.id)}
                >
                  {titleOf(state.properties, row)}
                </button>
              ))}
              {editable && (
                <button
                  type="button"
                  className="add-day"
                  onClick={() => onAddRow({ [dateProp.id]: key })}
                  aria-label={`${key} 에 새 항목`}
                >
                  <Plus size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 갤러리 보기: 항목을 카드로
export const GalleryView: FC<ViewProps> = ({ state, view, rows, members, editable, onOpenRow, onAddRow }) => (
  <div className="gallery-view">
    {rows.map((row) => (
      <article key={row.id} className="card" data-row={row.id} onClick={() => onOpenRow(row.id)}>
        <b>{titleOf(state.properties, row)}</b>
        <CardProps props={state.properties} row={row} skip={view.hidden || []} members={members} />
      </article>
    ))}
    {editable && (
      <button type="button" className="card add-card" onClick={() => onAddRow()}>
        <Plus size={16} /> 새 항목
      </button>
    )}
  </div>
);
