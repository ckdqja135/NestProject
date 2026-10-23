import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ChevronDown,
  Copy,
  Download,
  Minus,
  Plus,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
} from 'lucide-react';
import React, { FC, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import * as Y from 'yjs';
import { Remote } from './DesignCanvas';
import {
  absPos,
  cssOf,
  DNode,
  isLine,
  measureText,
  Snapshot,
  TYPE_LABELS,
  unionBounds,
  updateNodes,
  updatePage,
} from './model';
import { InspectorWrap } from './styles';
import { FRAME_PRESETS } from './templates';

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom' | 'hdist' | 'vdist';

const clean = (n: number) => Math.round(n * 100) / 100;

// 숫자 칸: 글자 쪽(X, Y …)을 좌우로 끌면 값이 바뀐다 (Figma 처럼)
const NumberField: FC<{
  label: React.ReactNode;
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  title?: string;
}> = ({ label, value, onChange, disabled, min, max, step = 1, suffix, title }) => {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const shown = value === null ? '여러 값' : `${clean(value)}${suffix || ''}`;
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  const commit = () => {
    const n = parseFloat(text.replace(/[^\d.+-]/g, ''));
    if (!Number.isNaN(n)) onChange(clamp(n));
  };
  const scrub = (e: React.PointerEvent) => {
    if (disabled || value === null) return;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    let current = value;
    const move = (ev: PointerEvent) => {
      current = clamp(current + ev.movementX * step * (ev.shiftKey ? 10 : 1));
      onChange(clean(current));
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };
  return (
    <label className="num" title={title}>
      <span onPointerDown={scrub}>{label}</span>
      <input
        value={focused ? text : shown}
        disabled={disabled}
        onFocus={(e) => {
          setFocused(true);
          setText(value === null ? '' : String(clean(value)));
          requestAnimationFrame(() => e.target.select());
        }}
        onBlur={() => {
          commit();
          setFocused(false);
        }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setFocused(false);
            (e.target as HTMLInputElement).blur();
          }
          if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && value !== null) {
            e.preventDefault();
            const next = clamp(value + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1));
            onChange(clean(next));
            setText(String(clean(next)));
          }
        }}
      />
    </label>
  );
};

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const normalizeHex = (value: string) => {
  const m = value.trim().match(HEX);
  if (!m) return null;
  const hex = m[1].length === 3 ? m[1].replace(/(.)/g, '$1$1') : m[1];
  return `#${hex.toLowerCase()}`;
};

const ColorField: FC<{ value: string | null; onChange: (value: string) => void; disabled?: boolean }> = ({
  value,
  onChange,
  disabled,
}) => {
  const [text, setText] = useState(value || '');
  useEffect(() => setText(value || ''), [value]);
  return (
    <div className="hex">
      <input
        type="color"
        value={value && HEX.test(value) ? normalizeHex(value) || '#000000' : '#000000'}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-label="색 고르기"
      />
      <input
        type="text"
        value={value === null ? '여러 값' : text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const hex = normalizeHex(text);
          if (hex) onChange(hex);
          else setText(value || '');
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        aria-label="색 코드"
      />
    </div>
  );
};

interface Props {
  doc: Y.Doc;
  snap: Snapshot;
  page: string;
  defaultBg: string;
  selection: string[];
  editable: boolean;
  frameTool: boolean;
  zoom: number;
  others: Remote[];
  onFollow: (remote: Remote) => void;
  onZoomMenu: (anchor: DOMRect) => void;
  onPreset: (preset: { name: string; w: number; h: number }) => void;
  onAlign: (mode: AlignMode) => void;
  onExport: (format: 'png' | 'svg', scale: number) => void;
}

const Inspector: FC<Props> = ({
  doc,
  snap,
  page,
  defaultBg,
  selection,
  editable,
  frameTool,
  zoom,
  others,
  onFollow,
  onZoomMenu,
  onPreset,
  onAlign,
  onExport,
}) => {
  const [tab, setTab] = useState<'design' | 'code'>('design');
  const [scale, setScale] = useState(2);
  const [format, setFormat] = useState<'png' | 'svg'>('png');
  const zoomRef = useRef<HTMLButtonElement>(null);
  const nodes = selection.map((id) => snap.nodes[id]).filter(Boolean) as DNode[];
  const single = nodes.length === 1 ? nodes[0] : null;
  const disabled = !editable;

  const same = <K extends keyof DNode>(key: K): DNode[K] | null => {
    if (!nodes.length) return null;
    const first = nodes[0][key];
    return nodes.every((n) => n[key] === first) ? first : null;
  };

  // 글 모양이 바뀌면 상자 크기를 다시 잰다
  const set = (fields: Partial<DNode>, only?: (n: DNode) => boolean) => {
    const changes: Record<string, Partial<DNode>> = {};
    nodes.forEach((n) => {
      if (only && !only(n)) return;
      let next: Partial<DNode> = fields;
      if (
        n.type === 'text' &&
        ('fontSize' in fields ||
          'fontWeight' in fields ||
          'lineHeight' in fields ||
          'w' in fields ||
          'textMode' in fields)
      ) {
        const merged = { ...n, ...fields };
        if ('w' in fields) merged.textMode = 'fixed';
        const size = measureText(merged);
        next = {
          ...fields,
          textMode: merged.textMode,
          h: size.h,
          ...(merged.textMode === 'auto' ? { w: size.w } : {}),
        };
      }
      changes[n.id] = next;
    });
    updateNodes(doc, changes);
  };

  const pageInfo = snap.pages.find((p) => p.id === page);
  const box = nodes.length ? unionBounds(snap, selection) : null;

  // 여러 개면 묶음 상자 기준으로 옮긴다
  const moveTo = (axis: 'x' | 'y', value: number) => {
    if (single) {
      set({ [axis]: value });
      return;
    }
    if (!box) return;
    const delta = value - box[axis];
    const changes: Record<string, Partial<DNode>> = {};
    nodes.forEach((n) => {
      changes[n.id] = { [axis]: n[axis] + delta };
    });
    updateNodes(doc, changes);
  };

  const people = (
    <div className="people">
      {others.map((o) => (
        <button
          key={o.clientId}
          type="button"
          style={{ background: o.color }}
          title={`${o.name} — 눌러서 그 사람이 보는 곳으로`}
          aria-label={`${o.name} 보는 곳으로`}
          onClick={() => onFollow(o)}
        >
          {o.name.slice(0, 1)}
        </button>
      ))}
    </div>
  );

  const header = (
    <>
      <div className="top">
        {people}
        <button
          ref={zoomRef}
          type="button"
          className="zoom-btn"
          onClick={() => zoomRef.current && onZoomMenu(zoomRef.current.getBoundingClientRect())}
          aria-label="확대 비율"
        >
          {Math.round(zoom * 100)}% <ChevronDown size={12} />
        </button>
      </div>
      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'design'}
          className={tab === 'design' ? 'on' : ''}
          onClick={() => setTab('design')}
        >
          디자인
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'code'}
          className={tab === 'code' ? 'on' : ''}
          onClick={() => setTab('code')}
        >
          코드
        </button>
      </div>
    </>
  );

  if (tab === 'code') {
    const code = single ? cssOf(single) : '';
    return (
      <InspectorWrap>
        {header}
        <div className="body">
          {single ? (
            <section>
              <h4>
                {TYPE_LABELS[single.type]} CSS
                <button
                  type="button"
                  className="icon-btn"
                  title="복사"
                  aria-label="CSS 복사"
                  onClick={() =>
                    navigator.clipboard
                      ?.writeText(code)
                      .then(() => toast.success('CSS 를 복사했어요.', { position: 'bottom-center', autoClose: 1500 }))
                  }
                >
                  <Copy size={13} />
                </button>
              </h4>
              <pre>{code}</pre>
              {single.type === 'text' && (
                <>
                  <h4>글</h4>
                  <pre>{single.text}</pre>
                </>
              )}
            </section>
          ) : (
            <p className="hint">요소 하나를 고르면 개발에 쓸 CSS 를 보여 줘요.</p>
          )}
        </div>
      </InspectorWrap>
    );
  }

  if (!nodes.length) {
    return (
      <InspectorWrap>
        {header}
        <div className="body">
          {frameTool && editable ? (
            <section className="presets">
              <h4>프레임 크기</h4>
              {FRAME_PRESETS.map((g) => (
                <React.Fragment key={g.group}>
                  <h5>{g.group}</h5>
                  {g.items.map((item) => (
                    <button key={item.name} type="button" onClick={() => onPreset(item)}>
                      {item.name}
                      <small>
                        {item.w}×{item.h}
                      </small>
                    </button>
                  ))}
                </React.Fragment>
              ))}
            </section>
          ) : (
            <>
              <section>
                <h4>페이지</h4>
                <div className="line">
                  <ColorField
                    value={pageInfo?.bg || defaultBg}
                    disabled={disabled}
                    onChange={(bg) => updatePage(doc, page, { bg })}
                  />
                </div>
              </section>
              <p className="hint">
                캔버스에서 요소를 고르면 위치·크기·색을 바꿀 수 있어요.
                <br />
                프레임 F · 사각형 R · 타원 O · 선 L · 글 T · 댓글 C
                <br />
                스페이스를 누른 채 끌면 화면 이동, ⌘(Ctrl)+휠로 확대해요.
              </p>
            </>
          )}
        </div>
      </InspectorWrap>
    );
  }

  const kind = single ? TYPE_LABELS[single.type] : `${nodes.length}개 고름`;
  const anyLine = nodes.some(isLine);
  const allText = nodes.every((n) => n.type === 'text');
  const hasShape = nodes.some((n) => n.type !== 'text' && !isLine(n));
  const fill = same('fill');
  const stroke = same('stroke');
  const pos = single ? { x: single.x, y: single.y } : box ? { x: box.x, y: box.y } : null;
  const relative = single && single.parent ? absPos(snap, single.id) : null;

  return (
    <InspectorWrap>
      {header}
      <div className="body">
        <div className="kind">{kind}</div>
        {editable && (
          <div className="align" role="group" aria-label="정렬">
            {(
              [
                ['left', AlignStartVertical, '왼쪽 맞춤'],
                ['hcenter', AlignCenterVertical, '가로 가운데'],
                ['right', AlignEndVertical, '오른쪽 맞춤'],
                ['top', AlignStartHorizontal, '위 맞춤'],
                ['vcenter', AlignCenterHorizontal, '세로 가운데'],
                ['bottom', AlignEndHorizontal, '아래 맞춤'],
              ] as const
            ).map(([mode, Icon, label]) => (
              <button
                key={mode}
                type="button"
                className="icon-btn"
                title={label}
                aria-label={label}
                disabled={nodes.length === 1 && !single?.parent}
                onClick={() => onAlign(mode)}
              >
                <Icon size={15} />
              </button>
            ))}
            {nodes.length >= 3 && (
              <>
                <button
                  type="button"
                  className="icon-btn"
                  title="가로 간격 똑같이"
                  aria-label="가로 간격 똑같이"
                  onClick={() => onAlign('hdist')}
                >
                  <AlignHorizontalDistributeCenter size={15} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="세로 간격 똑같이"
                  aria-label="세로 간격 똑같이"
                  onClick={() => onAlign('vdist')}
                >
                  <AlignVerticalDistributeCenter size={15} />
                </button>
              </>
            )}
          </div>
        )}

        <section>
          <h4>
            위치·크기
            {relative && <small style={{ color: 'var(--text-faint)', fontWeight: 400 }}>프레임 기준</small>}
          </h4>
          <div className="grid">
            <NumberField label="X" value={pos ? pos.x : null} onChange={(v) => moveTo('x', v)} disabled={disabled} />
            <NumberField label="Y" value={pos ? pos.y : null} onChange={(v) => moveTo('y', v)} disabled={disabled} />
            {!anyLine && (
              <>
                <NumberField label="W" value={same('w')} min={1} onChange={(w) => set({ w })} disabled={disabled} />
                <NumberField
                  label="H"
                  value={same('h')}
                  min={1}
                  onChange={(h) => set({ h }, (n) => n.type !== 'text')}
                  disabled={disabled || allText}
                  title={allText ? '글 상자 높이는 글에 맞춰져요' : undefined}
                />
              </>
            )}
            {single && isLine(single) && (
              <NumberField
                label="↔"
                title="길이"
                value={Math.hypot(single.w, single.h)}
                min={1}
                onChange={(len) => {
                  const angle = Math.atan2(single.h, single.w);
                  set({ w: clean(len * Math.cos(angle)), h: clean(len * Math.sin(angle)) });
                }}
                disabled={disabled}
              />
            )}
            {single && isLine(single) && (
              <NumberField
                label="∠"
                title="각도"
                suffix="°"
                value={(Math.atan2(single.h, single.w) * 180) / Math.PI}
                onChange={(deg) => {
                  const len = Math.hypot(single.w, single.h);
                  const r = (deg * Math.PI) / 180;
                  set({ w: clean(len * Math.cos(r)), h: clean(len * Math.sin(r)) });
                }}
                disabled={disabled}
              />
            )}
            {!anyLine && !nodes.some((n) => n.type === 'frame') && (
              <NumberField
                label="↻"
                title="돌리기"
                suffix="°"
                value={same('rotation')}
                onChange={(rotation) => set({ rotation })}
                disabled={disabled}
              />
            )}
            {nodes.every((n) => n.type === 'rect' || n.type === 'frame') && (
              <NumberField
                label="◜"
                title="모서리 둥글기"
                value={same('radius')}
                min={0}
                onChange={(radius) => set({ radius })}
                disabled={disabled}
              />
            )}
          </div>
          {single?.type === 'frame' && (
            <label className="check">
              <input
                type="checkbox"
                checked={single.clip}
                disabled={disabled}
                onChange={(e) => set({ clip: e.target.checked })}
              />
              프레임 밖 내용 자르기
            </label>
          )}
        </section>

        <section>
          <h4>레이어</h4>
          <div className="grid">
            <NumberField
              label="◐"
              title="불투명도"
              suffix="%"
              value={same('opacity') === null ? null : (same('opacity') as number) * 100}
              min={0}
              max={100}
              onChange={(v) => set({ opacity: clean(v / 100) })}
              disabled={disabled}
            />
          </div>
        </section>

        {allText && (
          <section>
            <h4>글</h4>
            <div className="grid">
              <NumberField
                label="Aa"
                title="글자 크기"
                value={same('fontSize')}
                min={1}
                max={400}
                onChange={(fontSize) => set({ fontSize })}
                disabled={disabled}
              />
              <select
                value={same('fontWeight') ?? ''}
                disabled={disabled}
                onChange={(e) => set({ fontWeight: Number(e.target.value) })}
                aria-label="글자 굵기"
              >
                {same('fontWeight') === null && <option value="">여러 값</option>}
                <option value={300}>가늘게</option>
                <option value={400}>보통</option>
                <option value={500}>중간</option>
                <option value={600}>약간 굵게</option>
                <option value={700}>굵게</option>
                <option value={800}>아주 굵게</option>
              </select>
              <NumberField
                label="↕"
                title="줄 높이 (배수)"
                value={same('lineHeight')}
                min={0.8}
                max={4}
                step={0.05}
                onChange={(lineHeight) => set({ lineHeight })}
                disabled={disabled}
              />
              <div className="seg" role="group" aria-label="글 정렬">
                {(
                  [
                    ['left', TextAlignStart, '왼쪽'],
                    ['center', TextAlignCenter, '가운데'],
                    ['right', TextAlignEnd, '오른쪽'],
                  ] as const
                ).map(([align, Icon, label]) => (
                  <button
                    key={align}
                    type="button"
                    className={same('align') === align ? 'on' : ''}
                    title={label}
                    aria-label={`${label} 정렬`}
                    disabled={disabled}
                    onClick={() => set({ align })}
                  >
                    <Icon size={13} />
                  </button>
                ))}
              </div>
            </div>
            <div className="line">
              <div className="seg" role="group" aria-label="글 상자 너비">
                <button
                  type="button"
                  className={same('textMode') === 'auto' ? 'on' : ''}
                  disabled={disabled}
                  onClick={() => set({ textMode: 'auto' })}
                >
                  자동 너비
                </button>
                <button
                  type="button"
                  className={same('textMode') === 'fixed' ? 'on' : ''}
                  disabled={disabled}
                  onClick={() => set({ textMode: 'fixed' })}
                >
                  고정 너비
                </button>
              </div>
            </div>
          </section>
        )}

        {(hasShape || allText) && (
          <section>
            <h4>
              {allText ? '글자 색' : '채우기'}
              {editable &&
                (fill ? (
                  !allText && (
                    <button
                      type="button"
                      className="icon-btn"
                      title="채우기 없애기"
                      aria-label="채우기 없애기"
                      onClick={() => set({ fill: '' }, (n) => n.type !== 'text')}
                    >
                      <Minus size={13} />
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className="icon-btn"
                    title="채우기 더하기"
                    aria-label="채우기 더하기"
                    onClick={() => set({ fill: allText ? '#1e1e1e' : '#d9d9d9' })}
                  >
                    <Plus size={13} />
                  </button>
                ))}
            </h4>
            {(fill || same('fill') === null) && (
              <div className="line">
                <ColorField value={fill} disabled={disabled} onChange={(v) => set({ fill: v })} />
              </div>
            )}
          </section>
        )}

        {!allText && (
          <section>
            <h4>
              {anyLine ? '선' : '테두리'}
              {editable &&
                (stroke ? (
                  !anyLine && (
                    <button
                      type="button"
                      className="icon-btn"
                      title="테두리 없애기"
                      aria-label="테두리 없애기"
                      onClick={() => set({ stroke: '' })}
                    >
                      <Minus size={13} />
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className="icon-btn"
                    title="테두리 더하기"
                    aria-label="테두리 더하기"
                    onClick={() => set({ stroke: '#1e1e1e', strokeWidth: 1 })}
                  >
                    <Plus size={13} />
                  </button>
                ))}
            </h4>
            {(stroke || same('stroke') === null) && (
              <div className="line">
                <ColorField value={stroke} disabled={disabled} onChange={(v) => set({ stroke: v })} />
                <div style={{ width: 72 }}>
                  <NumberField
                    label="≡"
                    title="굵기"
                    value={same('strokeWidth')}
                    min={0}
                    max={200}
                    onChange={(strokeWidth) => set({ strokeWidth })}
                    disabled={disabled}
                  />
                </div>
              </div>
            )}
          </section>
        )}

        {!anyLine && (
          <section>
            <h4>효과</h4>
            <label className="check">
              <input
                type="checkbox"
                checked={same('shadow') === true}
                disabled={disabled}
                onChange={(e) => set({ shadow: e.target.checked })}
              />
              그림자
            </label>
          </section>
        )}

        <section>
          <h4>내보내기</h4>
          <div className="grid">
            <select value={scale} onChange={(e) => setScale(Number(e.target.value))} aria-label="배율">
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={3}>3x</option>
            </select>
            <select value={format} onChange={(e) => setFormat(e.target.value as 'png' | 'svg')} aria-label="파일 형식">
              <option value="png">PNG</option>
              <option value="svg">SVG</option>
            </select>
          </div>
          <button type="button" className="primary" onClick={() => onExport(format, scale)}>
            <Download size={13} style={{ verticalAlign: '-2px' }} />{' '}
            {single ? displayLabel(single) : `${nodes.length}개`} 내보내기
          </button>
        </section>
      </div>
    </InspectorWrap>
  );
};

const displayLabel = (n: DNode) => n.name || TYPE_LABELS[n.type];

export default Inspector;
