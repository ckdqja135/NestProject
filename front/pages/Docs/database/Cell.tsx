import { IUser } from '@typings/db';
import { avatarUrl } from '@utils/avatar';
import { Check, ExternalLink, Plus, X } from 'lucide-react';
import React, { FC, useEffect, useRef, useState } from 'react';
import { CellValue, newId, OPTION_COLORS, Property, SelectOption } from './model';

export const optionStyle = (color: string): React.CSSProperties => ({
  background: `var(--opt-${color}, var(--opt-gray))`,
});

export const OptionPill: FC<{ option: SelectOption }> = ({ option }) => (
  <span className="pill" style={optionStyle(option.color)}>
    {option.name}
  </span>
);

export const PersonChip: FC<{ user?: IUser }> = ({ user }) =>
  user ? (
    <span className="person">
      <img src={avatarUrl(user, 32)} alt="" />
      {user.nickname}
    </span>
  ) : null;

const asList = (value: CellValue): string[] =>
  Array.isArray(value)
    ? value.map(String)
    : value === null || value === undefined || value === ''
    ? []
    : [String(value)];

// 값 보여주기 (표·보드·갤러리 공통)
export const CellView: FC<{ prop: Property; value: CellValue; members: IUser[] }> = ({ prop, value, members }) => {
  if (value === null || value === undefined || value === '') return null;
  switch (prop.type) {
    case 'select':
    case 'status': {
      const option = prop.options?.find((o) => o.id === value);
      return option ? <OptionPill option={option} /> : null;
    }
    case 'multiSelect':
      return (
        <span className="pills">
          {asList(value).map((id) => {
            const option = prop.options?.find((o) => o.id === id);
            return option ? <OptionPill key={id} option={option} /> : null;
          })}
        </span>
      );
    case 'person':
      return (
        <span className="pills">
          {asList(value).map((id) => (
            <PersonChip key={id} user={members.find((m) => m.id === Number(id))} />
          ))}
        </span>
      );
    case 'checkbox':
      return value ? <Check size={15} className="checked" /> : null;
    case 'date':
      return <span>{String(value).replace(/-/g, '.')}</span>;
    case 'url':
      return (
        <a href={String(value)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
          {String(value).replace(/^https?:\/\//, '')} <ExternalLink size={11} />
        </a>
      );
    case 'number':
      return <span className="num">{Number(value).toLocaleString('ko-KR')}</span>;
    default:
      return <span>{String(value)}</span>;
  }
};

interface PickerProps {
  prop: Property;
  value: CellValue;
  multiple: boolean;
  onChange: (value: CellValue) => void;
  onOptionsChange?: (options: SelectOption[]) => void;
  onClose: () => void;
  members?: IUser[];
}

// 선택·상태·사람 고르기 (찾기, 새 선택지 만들기)
export const OptionPicker: FC<PickerProps> = ({
  prop,
  value,
  multiple,
  onChange,
  onOptionsChange,
  onClose,
  members,
}) => {
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = asList(value);
  const isPerson = prop.type === 'person';
  const items: { id: string; label: string; option?: SelectOption; user?: IUser }[] = isPerson
    ? (members || []).map((m) => ({ id: String(m.id), label: m.nickname, user: m }))
    : (prop.options || []).map((o) => ({ id: o.id, label: o.name, option: o }));
  const q = query.trim().toLowerCase();
  const visible = items.filter((i) => !q || i.label.toLowerCase().includes(q));
  const canCreate = !isPerson && !!q && !items.some((i) => i.label.toLowerCase() === q) && !!onOptionsChange;

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  const toggle = (id: string) => {
    if (multiple) {
      const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
      onChange(isPerson ? next.map(Number).map(String) : next);
    } else {
      onChange(selected[0] === id ? null : id);
      onClose();
    }
  };

  const create = () => {
    const option: SelectOption = {
      id: newId(),
      name: query.trim(),
      color: OPTION_COLORS[(prop.options?.length || 0) % OPTION_COLORS.length],
    };
    onOptionsChange?.([...(prop.options || []), option]);
    setQuery('');
    if (multiple) onChange([...selected, option.id]);
    else {
      onChange(option.id);
      onClose();
    }
  };

  return (
    <div className="picker" ref={ref} role="dialog" aria-label={`${prop.name} 고르기`}>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Enter') {
            e.preventDefault();
            if (canCreate) create();
            else if (visible[0]) toggle(visible[0].id);
          }
        }}
        placeholder={isPerson ? '사람 찾기' : '찾거나 새로 만들기'}
        aria-label="찾기"
      />
      <div className="items" role="listbox">
        {visible.map((item) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={selected.includes(item.id)}
            className={selected.includes(item.id) ? 'on' : undefined}
            onClick={() => toggle(item.id)}
          >
            {item.option && <OptionPill option={item.option} />}
            {item.user && <PersonChip user={item.user} />}
            {selected.includes(item.id) && <Check size={14} className="mark" />}
          </button>
        ))}
        {canCreate && (
          <button type="button" className="create" onClick={create}>
            <Plus size={14} /> 만들기: <OptionPill option={{ id: 'new', name: query.trim(), color: 'gray' }} />
          </button>
        )}
        {!visible.length && !canCreate && <p className="none">없습니다</p>}
      </div>
      {selected.length > 0 && (
        <button type="button" className="clear" onClick={() => onChange(null)}>
          <X size={13} /> 비우기
        </button>
      )}
    </div>
  );
};

interface EditorProps {
  prop: Property;
  value: CellValue;
  members: IUser[];
  onChange: (value: CellValue) => void;
  onOptionsChange: (options: SelectOption[]) => void;
  onClose: () => void;
}

// 칸 고치기 (표에서 칸을 누르면, 항목 창에서)
export const CellEditor: FC<EditorProps> = ({ prop, value, members, onChange, onOptionsChange, onClose }) => {
  const [draft, setDraft] = useState(value === null || value === undefined ? '' : String(value));
  const commit = () => {
    if (prop.type === 'number') {
      const n = Number(draft.replace(/,/g, ''));
      onChange(draft.trim() === '' || Number.isNaN(n) ? null : n);
    } else if (prop.type === 'url') {
      const v = draft.trim();
      onChange(v && !/^https?:\/\//i.test(v) ? `https://${v}` : v);
    } else {
      onChange(draft);
    }
    onClose();
  };
  if (prop.type === 'select' || prop.type === 'status' || prop.type === 'multiSelect' || prop.type === 'person') {
    return (
      <OptionPicker
        prop={prop}
        value={value}
        multiple={prop.type === 'multiSelect' || prop.type === 'person'}
        onChange={onChange}
        onOptionsChange={onOptionsChange}
        onClose={onClose}
        members={members}
      />
    );
  }
  if (prop.type === 'date') {
    return (
      <input
        className="cell-input"
        type="date"
        autoFocus
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(e.target.value || null);
        }}
        onBlur={onClose}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && onClose()}
        aria-label={prop.name}
      />
    );
  }
  return (
    <input
      className="cell-input"
      autoFocus
      inputMode={prop.type === 'number' ? 'decimal' : undefined}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') onClose();
      }}
      aria-label={prop.name}
      placeholder={prop.type === 'url' ? 'https://' : undefined}
    />
  );
};
