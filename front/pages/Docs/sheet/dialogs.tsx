import Modal from '@components/Modal';
import { Actions } from '@components/ModalForm/styles';
import {
  AreaChart,
  ArrowDownAZ,
  ArrowUpAZ,
  BarChart3,
  BarChartHorizontal,
  LineChart,
  PieChart,
  Trash2,
} from 'lucide-react';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { ChartType, newId, Rule, RuleKind } from './model';
import { DialogBody, PopMenu } from './styles';

export const RULE_LABEL: Record<RuleKind, string> = {
  gt: '값이 ~보다 큼',
  lt: '값이 ~보다 작음',
  between: '값이 ~ 사이',
  eq: '값이 ~와 같음',
  contains: '글자를 포함',
  empty: '비어 있음',
  notEmpty: '비어 있지 않음',
  top: '상위 N개',
  scale: '색 눈금 (작은 값 → 큰 값)',
};

const PRESETS = [
  { name: '빨강', bg: '#fde2e4', color: '#b4232e' },
  { name: '초록', bg: '#e3f5e9', color: '#14743b' },
  { name: '노랑', bg: '#fff3c4', color: '#7a5b00' },
  { name: '파랑', bg: '#e1efff', color: '#1b4f9c' },
];

// 조건부 서식: 고른 범위에 규칙 추가, 이 시트의 규칙 목록
export const ConditionalDialog: FC<{
  show: boolean;
  range: string;
  rules: Rule[];
  onClose: () => void;
  onChange: (rules: Rule[]) => void;
}> = ({ show, range, rules, onClose, onChange }) => {
  const [kind, setKind] = useState<RuleKind>('gt');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [preset, setPreset] = useState(0);
  const [bold, setBold] = useState(false);
  useEffect(() => {
    if (show) {
      setA('');
      setB('');
    }
  }, [show]);
  const needsA = !['empty', 'notEmpty', 'scale'].includes(kind);
  const add = () => {
    const p = PRESETS[preset];
    const rule: Rule =
      kind === 'scale'
        ? { id: newId(), range, kind, bg: '#ffffff', color: '#57bb8a' }
        : {
            id: newId(),
            range,
            kind,
            a: needsA ? a : undefined,
            b: kind === 'between' ? b : undefined,
            bg: p.bg,
            color: p.color,
            bold,
          };
    onChange([...rules, rule]);
  };
  return (
    <Modal show={show} onCloseModal={onClose} title="조건부 서식" description={`범위 ${range}`}>
      <DialogBody>
        <div className="row">
          <select value={kind} onChange={(e) => setKind(e.target.value as RuleKind)} aria-label="조건">
            {(Object.keys(RULE_LABEL) as RuleKind[]).map((k) => (
              <option key={k} value={k}>
                {RULE_LABEL[k]}
              </option>
            ))}
          </select>
          {needsA && (
            <input
              type="text"
              value={a}
              onChange={(e) => setA(e.target.value)}
              placeholder={kind === 'top' ? '개수' : '값'}
              aria-label="값"
              style={{ width: 90 }}
            />
          )}
          {kind === 'between' && (
            <input
              type="text"
              value={b}
              onChange={(e) => setB(e.target.value)}
              placeholder="끝 값"
              aria-label="끝 값"
              style={{ width: 90 }}
            />
          )}
        </div>
        {kind !== 'scale' && (
          <div className="row">
            <label>모양</label>
            {PRESETS.map((p, i) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setPreset(i)}
                style={{
                  padding: '3px 10px',
                  border: `2px solid ${preset === i ? '#1264a3' : 'transparent'}`,
                  borderRadius: 4,
                  background: p.bg,
                  color: p.color,
                  cursor: 'pointer',
                }}
              >
                {p.name}
              </button>
            ))}
            <label style={{ fontWeight: 400 }}>
              <input type="checkbox" checked={bold} onChange={(e) => setBold(e.target.checked)} /> 굵게
            </label>
          </div>
        )}
        <div className="row">
          <button
            type="button"
            onClick={add}
            disabled={needsA && !a.trim()}
            className="add-rule"
            style={{
              height: 32,
              padding: '0 14px',
              borderRadius: 6,
              border: '1px solid #1264a3',
              background: '#1264a3',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            규칙 추가
          </button>
        </div>
        {rules.length > 0 && (
          <>
            <label>이 시트의 규칙</label>
            <ul>
              {rules.map((r) => (
                <li key={r.id}>
                  <span
                    className="sample"
                    style={{
                      background: r.kind === 'scale' ? 'linear-gradient(90deg,#fff,#57bb8a)' : r.bg,
                      color: r.color,
                      fontWeight: r.bold ? 700 : undefined,
                    }}
                  >
                    가나
                  </span>
                  <span>
                    {r.range} · {RULE_LABEL[r.kind]}
                    {r.a !== undefined && ` ${r.a}`}
                    {r.b !== undefined && ` ~ ${r.b}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => onChange(rules.filter((x) => x.id !== r.id))}
                    aria-label="규칙 지우기"
                    style={{
                      display: 'inline-flex',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        <Actions>
          <button type="button" className="primary" onClick={onClose}>
            닫기
          </button>
        </Actions>
      </DialogBody>
    </Modal>
  );
};

// 데이터 확인: 칸에서 고를 수 있는 값 목록
export const ValidationDialog: FC<{
  show: boolean;
  range: string;
  initial: string[];
  onClose: () => void;
  onSave: (items: string[] | null) => void;
}> = ({ show, range, initial, onClose, onSave }) => {
  const [text, setText] = useState('');
  useEffect(() => {
    if (show) setText(initial.join(', '));
    // 열 때만 처음 값으로
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);
  const items = text
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <Modal show={show} onCloseModal={onClose} title="드롭다운 목록" description={`범위 ${range} 의 칸에서 고를 값`}>
      <DialogBody>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="쉼표로 나눠 적기: 대기, 진행 중, 완료"
          aria-label="목록 값"
        />
        <Actions>
          <button type="button" onClick={() => onSave(null)}>
            목록 없애기
          </button>
          <button
            type="button"
            className="primary"
            disabled={!items.length}
            onClick={() => onSave(items.slice(0, 200))}
          >
            저장
          </button>
        </Actions>
      </DialogBody>
    </Modal>
  );
};

const CHART_TYPES: { type: ChartType; name: string; Icon: typeof BarChart3 }[] = [
  { type: 'column', name: '세로 막대', Icon: BarChart3 },
  { type: 'bar', name: '가로 막대', Icon: BarChartHorizontal },
  { type: 'line', name: '꺾은선', Icon: LineChart },
  { type: 'area', name: '영역', Icon: AreaChart },
  { type: 'pie', name: '원형', Icon: PieChart },
];

export const ChartDialog: FC<{
  show: boolean;
  initial: { type: ChartType; range: string; title?: string };
  editing: boolean;
  onClose: () => void;
  onSave: (v: { type: ChartType; range: string; title: string }) => void;
  onDelete?: () => void;
}> = ({ show, initial, editing, onClose, onSave, onDelete }) => {
  const [type, setType] = useState<ChartType>('column');
  const [range, setRange] = useState('');
  const [title, setTitle] = useState('');
  useEffect(() => {
    if (show) {
      setType(initial.type);
      setRange(initial.range);
      setTitle(initial.title || '');
    }
    // 열 때만 처음 값으로
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);
  return (
    <Modal
      show={show}
      onCloseModal={onClose}
      title={editing ? '차트 고치기' : '차트 넣기'}
      description="첫 행은 계열 이름, 첫 열은 항목으로 씁니다."
    >
      <DialogBody>
        <div className="row charts" role="radiogroup" aria-label="차트 종류">
          {CHART_TYPES.map(({ type: t, name, Icon }) => (
            <button
              key={t}
              type="button"
              className={type === t ? 'on' : undefined}
              onClick={() => setType(t)}
              aria-pressed={type === t}
            >
              <Icon size={22} />
              {name}
            </button>
          ))}
        </div>
        <div className="row">
          <label htmlFor="chart-range">데이터 범위</label>
          <input
            id="chart-range"
            type="text"
            value={range}
            onChange={(e) => setRange(e.target.value.toUpperCase())}
            style={{ width: 120 }}
          />
          <label htmlFor="chart-title">제목</label>
          <input
            id="chart-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ flex: 1, minWidth: 120 }}
          />
        </div>
        <Actions>
          {editing && onDelete && (
            <button type="button" onClick={onDelete}>
              차트 지우기
            </button>
          )}
          <button type="button" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="primary"
            disabled={!/^[A-Z]{1,3}\d+(:[A-Z]{1,3}\d+)?$/.test(range)}
            onClick={() => onSave({ type, range, title: title.trim() })}
          >
            {editing ? '저장' : '넣기'}
          </button>
        </Actions>
      </DialogBody>
    </Modal>
  );
};

export const NoteDialog: FC<{
  show: boolean;
  cell: string;
  initial: string;
  onClose: () => void;
  onSave: (note: string) => void;
}> = ({ show, cell, initial, onClose, onSave }) => {
  const [text, setText] = useState('');
  useEffect(() => {
    if (show) setText(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);
  return (
    <Modal show={show} onCloseModal={onClose} title={`${cell} 메모`}>
      <DialogBody>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          aria-label="메모"
          placeholder="칸에 남길 메모"
        />
        <Actions>
          {initial && (
            <button type="button" onClick={() => onSave('')}>
              메모 지우기
            </button>
          )}
          <button type="button" className="primary" onClick={() => onSave(text.trim())}>
            저장
          </button>
        </Actions>
      </DialogBody>
    </Modal>
  );
};

// 필터 단추를 누르면: 정렬, 값 고르기
export const FilterMenu: FC<{
  x: number;
  y: number;
  values: string[];
  hidden: string[];
  onSort: (desc: boolean) => void;
  onApply: (hidden: string[]) => void;
  onClose: () => void;
}> = ({ x, y, values, hidden, onSort, onApply, onClose }) => {
  const [off, setOff] = useState<Set<string>>(new Set(hidden));
  const [q, setQ] = useState('');
  const shown = useMemo(
    () => values.filter((v) => v.toLowerCase().includes(q.toLowerCase())).slice(0, 500),
    [values, q],
  );
  return (
    <PopMenu
      style={{ left: x, top: y, minWidth: 220 }}
      onMouseDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="필터"
    >
      <button type="button" onClick={() => onSort(false)}>
        <ArrowDownAZ size={15} /> 오름차순 정렬
      </button>
      <button type="button" onClick={() => onSort(true)}>
        <ArrowUpAZ size={15} /> 내림차순 정렬
      </button>
      <hr />
      <div style={{ padding: '4px 10px' }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="값 찾기"
          aria-label="값 찾기"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            height: 26,
            padding: '0 6px',
            border: '1px solid var(--border)',
            borderRadius: 4,
            background: 'var(--bg)',
            color: 'var(--text)',
          }}
        />
      </div>
      <div style={{ padding: '2px 12px', display: 'flex', gap: 10, fontSize: 12 }}>
        <a
          href="#all"
          onClick={(e) => {
            e.preventDefault();
            setOff(new Set());
          }}
        >
          모두 고르기
        </a>
        <a
          href="#none"
          onClick={(e) => {
            e.preventDefault();
            setOff(new Set(values));
          }}
        >
          모두 풀기
        </a>
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto', padding: '2px 12px' }}>
        {shown.map((v) => (
          <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!off.has(v)}
              onChange={(e) =>
                setOff((prev) => {
                  const next = new Set(prev);
                  if (e.target.checked) next.delete(v);
                  else next.add(v);
                  return next;
                })
              }
            />
            {v === '' ? '(빈 칸)' : v}
          </label>
        ))}
      </div>
      <hr />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, padding: '2px 10px 4px' }}>
        <button type="button" onClick={onClose} style={{ width: 'auto' }}>
          취소
        </button>
        <button
          type="button"
          onClick={() => onApply(Array.from(off))}
          style={{ width: 'auto', color: '#1264a3', fontWeight: 700 }}
        >
          적용
        </button>
      </div>
    </PopMenu>
  );
};
