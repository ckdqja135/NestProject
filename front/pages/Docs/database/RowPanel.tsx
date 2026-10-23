import { IUser } from '@typings/db';
import dayjs from 'dayjs';
import { Trash2, X } from 'lucide-react';
import React, { FC, useEffect, useState } from 'react';
import { CellEditor, CellView } from './Cell';
import { CellValue, Property, Row, SelectOption } from './model';
import { TYPE_ICONS } from './TableView';

interface Props {
  row: Row;
  properties: Property[];
  members: IUser[];
  editable: boolean;
  onCell: (propId: string, value: CellValue) => void;
  onOptions: (propId: string, options: SelectOption[]) => void;
  onDelete: () => void;
  onClose: () => void;
}

// 항목 하나 열어 보기: 모든 칸을 한눈에 보고 고친다
const RowPanel: FC<Props> = ({ row, properties, members, editable, onCell, onOptions, onDelete, onClose }) => {
  const title = properties.find((p) => p.type === 'title');
  const [titleDraft, setTitleDraft] = useState(String((title && row.values[title.id]) || ''));
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    setTitleDraft(String((title && row.values[title.id]) || ''));
    setConfirm(false);
    // 다른 항목을 열었을 때만 새로 채운다 (고치는 중 다른 사람 변경으로 덮이지 않게)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !editing && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, onClose]);
  const creator = members.find((m) => m.id === row.createdBy);
  return (
    <aside className="row-panel" aria-label="항목">
      <div className="panel-top">
        <button type="button" onClick={onClose} aria-label="닫기">
          <X size={18} />
        </button>
      </div>
      {title && (
        <input
          className="row-title"
          value={titleDraft}
          readOnly={!editable}
          placeholder="제목 없음"
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => titleDraft !== (row.values[title.id] || '') && onCell(title.id, titleDraft)}
          onKeyDown={(e) => !e.nativeEvent.isComposing && e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          aria-label="제목"
        />
      )}
      <dl className="row-props">
        {properties
          .filter((p) => p.type !== 'title')
          .map((p) => {
            const Icon = TYPE_ICONS[p.type];
            const value = row.values[p.id];
            return (
              <div key={p.id} className="prop">
                <dt>
                  <Icon size={14} /> {p.name}
                </dt>
                <dd
                  className={editable ? 'editable' : undefined}
                  onClick={() => {
                    if (!editable || editing === p.id) return;
                    if (p.type === 'checkbox') onCell(p.id, !value);
                    else setEditing(p.id);
                  }}
                >
                  {editing === p.id ? (
                    <CellEditor
                      prop={p}
                      value={value}
                      members={members}
                      onChange={(v) => onCell(p.id, v)}
                      onOptionsChange={(options) => onOptions(p.id, options)}
                      onClose={() => setEditing(null)}
                    />
                  ) : p.type === 'checkbox' ? (
                    <input type="checkbox" checked={!!value} readOnly tabIndex={-1} aria-label={p.name} />
                  ) : value === undefined || value === null || value === '' ? (
                    <span className="placeholder">비어 있음</span>
                  ) : (
                    <CellView prop={p} value={value} members={members} />
                  )}
                </dd>
              </div>
            );
          })}
      </dl>
      <p className="meta">
        {creator ? `${creator.nickname} · ` : ''}
        {row.createdAt ? dayjs(row.createdAt).format('YYYY.M.D HH:mm') : ''} 만듦
      </p>
      {editable &&
        (confirm ? (
          <div className="confirm">
            <span>이 항목을 지울까요?</span>
            <button type="button" className="danger" onClick={onDelete}>
              지우기
            </button>
            <button type="button" onClick={() => setConfirm(false)}>
              취소
            </button>
          </div>
        ) : (
          <button type="button" className="delete-row" onClick={() => setConfirm(true)}>
            <Trash2 size={14} /> 항목 지우기
          </button>
        ))}
    </aside>
  );
};

export default RowPanel;
