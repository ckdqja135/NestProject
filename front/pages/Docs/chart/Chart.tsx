import React, { FC, memo } from 'react';

export type ChartKind = 'column' | 'bar' | 'line' | 'area' | 'pie';

export interface ChartData {
  categories: string[];
  series: { name: string; values: number[] }[];
}

export const CHART_COLORS = ['#2f80ed', '#e8891d', '#12a06b', '#e0405a', '#7c5cd6', '#17a2a8', '#d64a9b', '#6b7280'];

// 표(첫 행: 계열 이름, 첫 열: 항목)를 차트 데이터로
export const tableToChart = (rows: (string | number | null)[][]): ChartData => {
  if (!rows.length) return { categories: [], series: [] };
  const isNum = (v: unknown) => typeof v === 'number';
  const headerRow =
    rows[0].slice(1).some((v) => v !== null && !isNum(v)) ||
    (rows[0][0] !== null && !isNum(rows[0][0]) && rows[0].slice(1).every((v) => !isNum(v)));
  const firstColLabels = rows.slice(headerRow ? 1 : 0).some((row) => row[0] !== null && !isNum(row[0]));
  const body = rows.slice(headerRow ? 1 : 0);
  const startCol = firstColLabels ? 1 : 0;
  const width = Math.max(...rows.map((r) => r.length));
  const categories = body.map((row, i) => (firstColLabels ? String(row[0] ?? '') : String(i + 1)));
  const series: ChartData['series'] = [];
  for (let c = startCol; c < width; c += 1) {
    series.push({
      name: headerRow ? String(rows[0][c] ?? `계열 ${c}`) : `계열 ${c - startCol + 1}`,
      values: body.map((row) => (typeof row[c] === 'number' ? (row[c] as number) : 0)),
    });
  }
  return { categories, series };
};

const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};
const short = (n: number) =>
  Math.abs(n) >= 1e8
    ? `${+(n / 1e8).toFixed(1)}억`
    : Math.abs(n) >= 1e4
    ? `${+(n / 1e4).toFixed(1)}만`
    : `${+n.toFixed(2)}`;

interface Props {
  type: ChartKind;
  data: ChartData;
  title?: string;
  width: number;
  height: number;
  color?: string; // 글자색
  background?: string;
}

// SVG 차트: 세로·가로 막대, 꺾은선, 영역, 원형
const Chart: FC<Props> = ({ type, data, title, width, height, color = '#1d1c1d', background = 'transparent' }) => {
  const W = Math.max(80, width);
  const H = Math.max(60, height);
  const titleH = title ? 24 : 6;
  const legendH = data.series.length > 1 || type === 'pie' ? 22 : 0;
  const font = 11;

  if (type === 'pie') {
    const s = data.series[0];
    const values = s ? s.values.map((v) => Math.max(0, v)) : [];
    const total = values.reduce((a, b) => a + b, 0) || 1;
    const r = Math.max(10, Math.min(W, H - titleH - legendH) / 2 - 8);
    const cx = W / 2;
    const cy = titleH + (H - titleH - legendH) / 2;
    let angle = -Math.PI / 2;
    return (
      <svg width={W} height={H} style={{ background, display: 'block' }} role="img" aria-label={title || '원형 차트'}>
        {title && (
          <text x={W / 2} y={16} textAnchor="middle" fontSize={13} fontWeight={700} fill={color}>
            {title}
          </text>
        )}
        {values.map((v, i) => {
          const slice = (v / total) * Math.PI * 2;
          const a0 = angle;
          angle += slice;
          const large = slice > Math.PI ? 1 : 0;
          const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
          const p1 = [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
          const mid = a0 + slice / 2;
          const d =
            slice >= Math.PI * 2 - 1e-6
              ? `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`
              : `M ${cx} ${cy} L ${p0[0]} ${p0[1]} A ${r} ${r} 0 ${large} 1 ${p1[0]} ${p1[1]} Z`;
          return (
            <g key={i}>
              <path
                d={d}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                stroke={background === 'transparent' ? '#fff' : background}
                strokeWidth={1}
              />
              {v / total > 0.06 && (
                <text
                  x={cx + r * 0.62 * Math.cos(mid)}
                  y={cy + r * 0.62 * Math.sin(mid) + 4}
                  textAnchor="middle"
                  fontSize={font}
                  fill="#fff"
                  fontWeight={700}
                >
                  {Math.round((v / total) * 100)}%
                </text>
              )}
            </g>
          );
        })}
        <Legend names={data.categories} y={H - 8} width={W} color={color} />
      </svg>
    );
  }

  const horizontal = type === 'bar';
  const all = data.series.flatMap((s) => s.values);
  const maxV = niceMax(Math.max(0, ...all));
  const minV = Math.min(0, ...all) < 0 ? -niceMax(-Math.min(...all)) : 0;
  const left = horizontal ? Math.min(90, Math.max(30, ...data.categories.map((c) => c.length * 7 + 8))) : 40;
  const plot = { x: left, y: titleH + 4, w: W - left - 10, h: H - titleH - legendH - (horizontal ? 18 : 22) };
  const n = Math.max(1, data.categories.length);
  const scale = (v: number) => (v - minV) / (maxV - minV || 1);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => minV + (maxV - minV) * t);
  const band = (horizontal ? plot.h : plot.w) / n;
  const sCount = Math.max(1, data.series.length);
  const barW = Math.max(2, (band * 0.7) / (type === 'column' || type === 'bar' ? sCount : 1));

  return (
    <svg width={W} height={H} style={{ background, display: 'block' }} role="img" aria-label={title || '차트'}>
      {title && (
        <text x={W / 2} y={16} textAnchor="middle" fontSize={13} fontWeight={700} fill={color}>
          {title}
        </text>
      )}
      {ticks.map((t) => {
        const pos = horizontal ? plot.x + scale(t) * plot.w : plot.y + plot.h - scale(t) * plot.h;
        return (
          <g key={t}>
            {horizontal ? (
              <line x1={pos} x2={pos} y1={plot.y} y2={plot.y + plot.h} stroke={color} strokeOpacity={0.12} />
            ) : (
              <line x1={plot.x} x2={plot.x + plot.w} y1={pos} y2={pos} stroke={color} strokeOpacity={0.12} />
            )}
            <text
              x={horizontal ? pos : plot.x - 4}
              y={horizontal ? plot.y + plot.h + 13 : pos + 4}
              textAnchor={horizontal ? 'middle' : 'end'}
              fontSize={font - 1}
              fill={color}
              fillOpacity={0.7}
            >
              {short(t)}
            </text>
          </g>
        );
      })}
      {data.categories.map((cat, i) => {
        const pos = (horizontal ? plot.y : plot.x) + band * i + band / 2;
        const label = cat.length > 10 ? `${cat.slice(0, 9)}…` : cat;
        return horizontal ? (
          <text key={i} x={plot.x - 4} y={pos + 4} textAnchor="end" fontSize={font} fill={color}>
            {label}
          </text>
        ) : (
          <text key={i} x={pos} y={plot.y + plot.h + 14} textAnchor="middle" fontSize={font} fill={color}>
            {n > 12 && i % Math.ceil(n / 12) ? '' : label}
          </text>
        );
      })}
      {data.series.map((s, si) => {
        const fill = CHART_COLORS[si % CHART_COLORS.length];
        if (type === 'line' || type === 'area') {
          const pts = s.values.map((v, i) => [plot.x + band * i + band / 2, plot.y + plot.h - scale(v) * plot.h]);
          const line = pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0]} ${p[1]}`).join(' ');
          const zeroY = plot.y + plot.h - scale(0) * plot.h;
          return (
            <g key={s.name + si}>
              {type === 'area' && pts.length > 0 && (
                <path
                  d={`${line} L ${pts[pts.length - 1][0]} ${zeroY} L ${pts[0][0]} ${zeroY} Z`}
                  fill={fill}
                  fillOpacity={0.25}
                />
              )}
              <path d={line} fill="none" stroke={fill} strokeWidth={2.5} />
              {pts.map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r={3} fill={fill} />
              ))}
            </g>
          );
        }
        return (
          <g key={s.name + si}>
            {s.values.map((v, i) => {
              const start = (horizontal ? plot.y : plot.x) + band * i + band * 0.15 + barW * si;
              const zero = scale(0);
              const val = scale(v);
              if (horizontal) {
                const x = plot.x + Math.min(zero, val) * plot.w;
                return (
                  <rect
                    key={i}
                    x={x}
                    y={start}
                    width={Math.abs(val - zero) * plot.w}
                    height={barW}
                    fill={fill}
                    rx={2}
                  />
                );
              }
              const y = plot.y + plot.h - Math.max(zero, val) * plot.h;
              return (
                <rect key={i} x={start} y={y} width={barW} height={Math.abs(val - zero) * plot.h} fill={fill} rx={2} />
              );
            })}
          </g>
        );
      })}
      {data.series.length > 1 && <Legend names={data.series.map((s) => s.name)} y={H - 8} width={W} color={color} />}
    </svg>
  );
};

const Legend: FC<{ names: string[]; y: number; width: number; color: string }> = ({ names, y, width, color }) => {
  const item = Math.min(110, width / Math.max(1, names.length));
  const start = (width - item * names.length) / 2;
  return (
    <g>
      {names.map((name, i) => (
        <g key={i} transform={`translate(${start + item * i}, ${y})`}>
          <rect x={0} y={-8} width={9} height={9} rx={2} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          <text x={13} y={0} fontSize={10.5} fill={color}>
            {name.length > 12 ? `${name.slice(0, 11)}…` : name}
          </text>
        </g>
      ))}
    </g>
  );
};

export default memo(Chart);
