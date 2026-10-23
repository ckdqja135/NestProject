import { IUser } from '@typings/db';
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Calendar,
  CheckSquare,
  CircleDot,
  EyeOff,
  Hash,
  Link,
  List,
  LucideIcon,
  Maximize2,
  Plus,
  Tags,
  Trash2,
  Type,
  User,
  AlignLeft,
} from 'lucide-react';
import React, { FC, useEffect, useRef, useState } from 'react';
import { CellEditor, CellView } from './Cell';
import { CellValue, DatabaseState, Property, PropType, Row, SelectOption, TYPE_LABELS, View } from './model';

export const TYPE_ICONS: Record<PropType, LucideIcon> = {
  title: Type,
  text: AlignLeft,
  number: Hash,
  select: CircleDot,
  multiSelect: Tags,
  status: List,
  date: Calendar,
  person: User,
  checkbox: CheckSquare,
  url: Link,
};

export interface ViewProps {
  state: DatabaseState;
  view: View;
  rows: Row[];
  members: IUser[];
  editable: boolean;
  onCell: (rowId: string, propId: string, value: CellValue) => void;
  onOptions: (propId: string, options: SelectOption[]) => void;
  onOpenRow: (rowId: string) => void;
  onAddRow: (values?: Record<string, CellValue>) => void;
  onUpdateView: (changes: Partial<View>) => void;
}

interface TableProps extends ViewProps {
  onAddProperty: () => void;
  onUpdateProperty: (propId: string, changes: Partial<Property>) => void;
  onDeleteProperty: (propId: string) => void;
}

// 칸 머리 메뉴: 이름·종류 바꾸기, 정렬, 숨기기, 지우기
const PropertyMenu: FC<{
  prop: Property;
  editable: boolean;
  onClose: () => void;
  onUpdate: (changes: Partial<Property>) => void;
  onSort: (dir: 'asc' | 'desc') => void;
  onHide: () => void;
  onDelete: () => void;
}> = ({ prop, editable, onClose, onUpdate, onSort, onHide, onDelete }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(prop.name);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);
  const saveName = () => {
    if (name.trim() && name.trim() !== prop.name) onUpdate({ name: name.trim() });
  };
  return (
    <div className="prop-menu" ref={ref} role="menu" aria-label={`${prop.name} 칸 설정`}>
      {editable && (
        <>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === 'Enter') {
                saveName();
                onClose();
              }
            }}
            aria-label="칸 이름"
            maxLength={50}
          />
          {prop.type !== 'title' && (
            <label className="row">
              종류
              <select
                value={prop.type}
                onChange={(e) => {
                  const type = e.target.value as PropType;
                  const needsOptions = type === 'select' || type === 'multiSelect' || type === 'status';
                  onUpdate({ type, options: needsOptions ? prop.options || [] : undefined });
                }}
                aria-label="칸 종류"
              >
                {(Object.keys(TYPE_LABELS) as PropType[])
                  .filter((t) => t !== 'title')
                  .map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <hr />
        </>
      )}
      <button type="button" role="menuitem" onClick={() => onSort('asc')}>
        <ArrowUpNarrowWide size={14} /> 오름차순 정렬
      </button>
      <button type="button" role="menuitem" onClick={() => onSort('desc')}>
        <ArrowDownWideNarrow size={14} /> 내림차순 정렬
      </button>
      {prop.type !== 'title' && (
        <button type="button" role="menuitem" onClick={onHide}>
          <EyeOff size={14} /> 이 보기에서 숨기기
        </button>
      )}
      {editable && prop.type !== 'title' && (
        <button type="button" role="menuitem" className="danger" onClick={onDelete}>
          <Trash2 size={14} /> 칸 지우기
        </button>
      )}
    </div>
  );
};

// 표 보기: 칸을 눌러 바로 고치고, 이름 칸의 '열기' 로 항목 창을 연다
const TableView: FC<TableProps> = ({
  state,
  view,
  rows,
  members,
  editable,
  onCell,
  onOptions,
  onOpenRow,
  onAddRow,
  onUpdateView,
  onAddProperty,
  onUpdateProperty,
  onDeleteProperty,
}) => {
  const [editing, setEditing] = useState<{ row: string; prop: string } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const hidden = new Set(view.hidden || []);
  const props = state.properties.filter((p) => !hidden.has(p.id));

  return (
    <div className="table-wrap">
      <table className="db-table">
        <thead>
          <tr>
            {props.map((p) => {
              const Icon = TYPE_ICONS[p.type];
              const sort = view.sorts?.find((s) => s.prop === p.id);
              return (
                <th key={p.id} className={p.type === 'title' ? 'title-col' : undefined}>
                  <button type="button" className="th" onClick={() => setMenu(menu === p.id ? null : p.id)}>
                    <Icon size={13} /> {p.name}
                    {sort && (sort.dir === 'asc' ? <ArrowUpNarrowWide size={12} /> : <ArrowDownWideNarrow size={12} />)}
                  </button>
                  {menu === p.id && (
                    <PropertyMenu
                      prop={p}
                      editable={editable}
                      onClose={() => setMenu(null)}
                      onUpdate={(changes) => onUpdateProperty(p.id, changes)}
                      onSort={(dir) => {
                        onUpdateView({ sorts: [{ prop: p.id, dir }] });
                        setMenu(null);
                      }}
                      onHide={() => {
                        onUpdateView({ hidden: [...(view.hidden || []), p.id] });
                        setMenu(null);
                      }}
                      onDelete={() => {
                        onDeleteProperty(p.id);
                        setMenu(null);
                      }}
                    />
                  )}
                </th>
              );
            })}
            {editable && (
              <th className="add-col">
                <button type="button" className="th" onClick={onAddProperty} aria-label="칸 더하기" title="칸 더하기">
                  <Plus size={14} />
                </button>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-row={row.id}>
              {props.map((p) => {
                const isEditing = editing?.row === row.id && editing.prop === p.id;
                const value = row.values[p.id];
                return (
                  <td
                    key={p.id}
                    className={`${p.type === 'title' ? 'title-col' : ''}${isEditing ? ' editing' : ''}`}
                    onClick={() => {
                      if (!editable || isEditing) return;
                      if (p.type === 'checkbox') onCell(row.id, p.id, !value);
                      else setEditing({ row: row.id, prop: p.id });
                    }}
                  >
                    {isEditing ? (
                      <CellEditor
                        prop={p}
                        value={value}
                        members={members}
                        onChange={(v) => onCell(row.id, p.id, v)}
                        onOptionsChange={(options) => onOptions(p.id, options)}
                        onClose={() => setEditing(null)}
                      />
                    ) : p.type === 'checkbox' ? (
                      <input type="checkbox" checked={!!value} readOnly tabIndex={-1} aria-label={p.name} />
                    ) : (
                      <CellView prop={p} value={value} members={members} />
                    )}
                    {p.type === 'title' && !isEditing && (
                      <>
                        {!value && <span className="untitled">제목 없음</span>}
                        <button
                          type="button"
                          className="open-row"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenRow(row.id);
                          }}
                        >
                          <Maximize2 size={12} /> 열기
                        </button>
                      </>
                    )}
                  </td>
                );
              })}
              {editable && <td />}
            </tr>
          ))}
        </tbody>
      </table>
      {editable && (
        <button type="button" className="add-row" onClick={() => onAddRow()}>
          <Plus size={14} /> 새 항목
        </button>
      )}
      {!rows.length && !editable && <p className="empty">항목이 없습니다.</p>}
    </div>
  );
};

export default TableView;
