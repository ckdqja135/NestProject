import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import Chart, { tableToChart } from '@pages/Docs/chart/Chart';
import { renderDocMarkdown } from '@utils/docMarkdown';
import React, { FC, memo } from 'react';
import { FONTS, H, parseChartData, safeSrc, ShapeKind, Slide, SlideElement, W } from './model';

export const Canvas = styled.div`
  position: relative;
  width: ${W}px;
  height: ${H}px;
  overflow: hidden;
  transform-origin: 0 0;
`;

// 슬라이드 글: 마크다운을 쓰되 문서보다 촘촘하게
export const SlideText = styled.div`
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  line-height: 1.3;
  word-break: break-word;
  overflow: hidden;

  & > div > *:first-of-type {
    margin-top: 0;
  }

  & h1,
  & h2,
  & h3 {
    margin: 0.2em 0;
    font-size: 1.3em;
    border: none;
    padding: 0;
  }

  & h1 {
    font-size: 1.6em;
  }

  & p {
    margin: 0.2em 0;
  }

  & ul,
  & ol {
    margin: 0.2em 0;
    padding-left: 1.2em;
  }

  & li {
    margin: 0.15em 0;
  }

  & .md-code {
    padding: 0 0.2em;
    border-radius: 3px;
    background: rgba(127, 127, 127, 0.18);
    font-family: Monaco, Menlo, Consolas, monospace;
    font-size: 0.85em;
  }

  & .doc-quote {
    margin: 0.3em 0;
    padding-left: 0.6em;
    border-left: 4px solid currentColor;
    opacity: 0.8;
  }

  & a {
    color: inherit;
  }

  & .doc-tasks {
    list-style: none;
    padding-left: 0.2em;
  }
`;

const SlideTable = styled.table`
  width: 100%;
  height: 100%;
  border-collapse: collapse;
  table-layout: fixed;

  & td,
  & th {
    padding: 4px 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: break-word;
    text-align: left;
    vertical-align: middle;
  }

  & th {
    font-weight: 700;
  }
`;

const fadeIn = keyframes`from { opacity: 0 } to { opacity: 1 }`;
const upIn = keyframes`from { opacity: 0; transform: translateY(40px) } to { opacity: 1; transform: none }`;
const leftIn = keyframes`from { opacity: 0; transform: translateX(-60px) } to { opacity: 1; transform: none }`;
const zoomIn = keyframes`from { opacity: 0; transform: scale(0.6) } to { opacity: 1; transform: none }`;

const AnimBox = styled.div`
  width: 100%;
  height: 100%;

  &.anim-fade {
    animation: ${fadeIn} 0.5s ease-out both;
  }
  &.anim-up {
    animation: ${upIn} 0.5s ease-out both;
  }
  &.anim-left {
    animation: ${leftIn} 0.5s ease-out both;
  }
  &.anim-zoom {
    animation: ${zoomIn} 0.45s ease-out both;
  }
`;

// 단위 상자(0~1) 위 꼭짓점들
const POLYS: Partial<Record<ShapeKind, [number, number][]>> = {
  triangle: [
    [0.5, 0],
    [1, 1],
    [0, 1],
  ],
  diamond: [
    [0.5, 0],
    [1, 0.5],
    [0.5, 1],
    [0, 0.5],
  ],
  pentagon: Array.from({ length: 5 }, (_, i) => {
    const a = (-90 + i * 72) * (Math.PI / 180);
    return [0.5 + 0.5 * Math.cos(a), 0.53 + 0.5 * Math.sin(a)] as [number, number];
  }),
  hexagon: [
    [0.25, 0],
    [0.75, 0],
    [1, 0.5],
    [0.75, 1],
    [0.25, 1],
    [0, 0.5],
  ],
  star: Array.from({ length: 10 }, (_, i) => {
    const a = (-90 + i * 36) * (Math.PI / 180);
    const r = i % 2 ? 0.2 : 0.5;
    return [0.5 + r * Math.cos(a), 0.53 + r * Math.sin(a)] as [number, number];
  }),
  chevron: [
    [0, 0],
    [0.75, 0],
    [1, 0.5],
    [0.75, 1],
    [0, 1],
    [0.25, 0.5],
  ],
  plus: [
    [0.35, 0],
    [0.65, 0],
    [0.65, 0.35],
    [1, 0.35],
    [1, 0.65],
    [0.65, 0.65],
    [0.65, 1],
    [0.35, 1],
    [0.35, 0.65],
    [0, 0.65],
    [0, 0.35],
    [0.35, 0.35],
  ],
  parallelogram: [
    [0.25, 0],
    [1, 0],
    [0.75, 1],
    [0, 1],
  ],
};

const DASH = { solid: undefined, dashed: '8 6', dotted: '2 5' };

const ShapeSvg: FC<{ el: SlideElement }> = ({ el }) => {
  const sw = el.strokeWidth ?? (el.stroke ? 2 : 0);
  const fill = el.fill || 'transparent';
  const stroke = el.stroke || 'none';
  const half = sw / 2;
  const w = el.w;
  const h = el.h;
  const dash = DASH[el.dash || 'solid'];
  const map = (pts: [number, number][]) =>
    pts.map(([px, py]) => `${half + px * Math.max(0, w - sw)},${half + py * Math.max(0, h - sw)}`).join(' ');
  let shape: React.ReactNode;
  switch (el.shape) {
    case 'ellipse':
      shape = <ellipse cx={w / 2} cy={h / 2} rx={Math.max(0, w / 2 - half)} ry={Math.max(0, h / 2 - half)} />;
      break;
    case 'arrow': {
      const body = h * 0.3;
      const head = Math.min(w * 0.4, h);
      shape = (
        <polygon
          points={`${half},${h / 2 - body} ${w - head},${h / 2 - body} ${w - head},${half} ${w - half},${h / 2} ${
            w - head
          },${h - half} ${w - head},${h / 2 + body} ${half},${h / 2 + body}`}
        />
      );
      break;
    }
    case 'callout': {
      const bh = h * 0.78;
      const r = Math.min(w, bh) * 0.12;
      shape = (
        <path
          d={`M ${half + r} ${half} H ${w - half - r} Q ${w - half} ${half} ${w - half} ${half + r} V ${bh - r} Q ${
            w - half
          } ${bh} ${w - half - r} ${bh} H ${w * 0.38} L ${w * 0.2} ${h - half} L ${w * 0.24} ${bh} H ${
            half + r
          } Q ${half} ${bh} ${half} ${bh - r} V ${half + r} Q ${half} ${half} ${half + r} ${half} Z`}
        />
      );
      break;
    }
    case 'line':
      return (
        <svg width={w} height={h} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden="true">
          <line
            x1={0}
            y1={h / 2}
            x2={w}
            y2={h / 2}
            stroke={el.stroke || '#1d1c1d'}
            strokeWidth={el.strokeWidth || 3}
            strokeDasharray={dash}
            strokeLinecap="round"
          />
        </svg>
      );
    case 'round':
    case 'rect':
    case undefined: {
      const radius = el.shape === 'round' ? el.radius ?? Math.min(w, h) * 0.15 : el.radius || 0;
      shape = <rect x={half} y={half} width={Math.max(0, w - sw)} height={Math.max(0, h - sw)} rx={radius} />;
      break;
    }
    default: {
      const pts = POLYS[el.shape];
      shape = pts ? <polygon points={map(pts)} /> : <rect x={half} y={half} width={w - sw} height={h - sw} />;
    }
  }
  return (
    <svg
      width={w}
      height={h}
      style={{ position: 'absolute', inset: 0 }}
      fill={fill}
      stroke={stroke}
      strokeWidth={sw}
      strokeDasharray={dash}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shape}
    </svg>
  );
};

const VALIGN = { top: 'flex-start', middle: 'center', bottom: 'flex-end' } as const;

export const textStyle = (el: SlideElement): React.CSSProperties => ({
  fontSize: el.fontSize || 24,
  fontWeight: el.bold ? 700 : undefined,
  fontStyle: el.italic ? 'italic' : undefined,
  textDecoration: [el.underline && 'underline', el.strike && 'line-through'].filter(Boolean).join(' ') || undefined,
  fontFamily: el.font ? FONTS[el.font]?.css : undefined,
  lineHeight: el.lineHeight || undefined,
  color: el.color,
  textAlign: el.align || (el.type === 'shape' ? 'center' : 'left'),
});

export const ElementBody: FC<{
  el: SlideElement;
  workspace: string;
  emojis?: Record<string, string>;
  hideText?: boolean;
}> = ({ el, workspace, emojis, hideText }) => {
  if (el.type === 'image') {
    const src = safeSrc(el.src);
    return src ? (
      <img
        src={src}
        alt=""
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          borderRadius: el.radius || 0,
          border: el.stroke ? `${el.strokeWidth || 2}px ${el.dash || 'solid'} ${el.stroke}` : undefined,
          boxSizing: 'border-box',
        }}
      />
    ) : (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          background: '#eee',
          color: '#888',
        }}
      >
        그림
      </div>
    );
  }
  if (el.type === 'table' && el.table) {
    const t = el.table;
    const border = `1px solid ${t.border || '#c7ccd1'}`;
    return (
      <SlideTable style={{ ...textStyle(el), fontSize: el.fontSize || 18 }}>
        <tbody>
          {t.rows.map((row, r) => (
            <tr key={`r${r}`}>
              {row.map((cell, c) => {
                const head = t.header && r === 0;
                const Tag = head ? 'th' : 'td';
                return (
                  <Tag
                    key={`c${c}`}
                    style={{
                      border,
                      background: head ? t.headerBg || '#1264a3' : r % 2 === 0 ? 'rgba(127,127,127,0.06)' : undefined,
                      color: head ? '#ffffff' : undefined,
                    }}
                  >
                    {cell}
                  </Tag>
                );
              })}
            </tr>
          ))}
        </tbody>
      </SlideTable>
    );
  }
  if (el.type === 'chart' && el.chart) {
    return (
      <div style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
        <Chart
          type={el.chart.type}
          data={tableToChart(parseChartData(el.chart.data))}
          title={el.chart.title}
          width={el.w}
          height={el.h}
          color={el.color || '#1d1c1d'}
        />
      </div>
    );
  }
  return (
    <>
      {el.type === 'shape' && <ShapeSvg el={el} />}
      {!hideText && el.text && el.shape !== 'line' && (
        <SlideText
          style={{
            position: 'relative',
            justifyContent: VALIGN[el.valign || (el.type === 'shape' ? 'middle' : 'top')],
            ...textStyle(el),
          }}
        >
          <div>{renderDocMarkdown(el.text, workspace, emojis).nodes}</div>
        </SlideText>
      )}
    </>
  );
};

// 요소 겉모습 (위치·회전·투명도·그림자)
export const frameStyle = (
  el: Pick<SlideElement, 'x' | 'y' | 'w' | 'h' | 'rot' | 'opacity' | 'shadow'>,
): React.CSSProperties => ({
  position: 'absolute',
  left: el.x,
  top: el.y,
  width: el.w,
  height: el.h,
  transform: el.rot ? `rotate(${el.rot}deg)` : undefined,
  opacity: el.opacity ?? undefined,
  filter: el.shadow ? 'drop-shadow(0 6px 10px rgba(0,0,0,0.3))' : undefined,
});

interface Props {
  slide: Slide;
  scale: number;
  workspace: string;
  emojis?: Record<string, string>;
  // 발표: 애니메이션이 있는 요소 중 몇 개까지 보였는지 (없으면 모두)
  reveal?: number;
}

// 슬라이드 한 쪽을 그린다 (목록 미리보기, 발표 모드, 인쇄)
const SlideView: FC<Props> = ({ slide, scale, workspace, emojis, reveal }) => {
  let animIndex = 0;
  return (
    <div style={{ width: W * scale, height: H * scale, overflow: 'hidden' }}>
      <Canvas style={{ background: slide.background, transform: `scale(${scale})` }}>
        {slide.elements.map((el) => {
          let cls: string | undefined;
          if (reveal !== undefined && el.anim && el.anim !== 'none') {
            const order = animIndex;
            animIndex += 1;
            if (order >= reveal) return null;
            cls = order === reveal - 1 ? `anim-${el.anim}` : undefined;
          }
          return (
            <div key={el.id} style={frameStyle(el)}>
              <AnimBox className={cls}>
                <ElementBody el={el} workspace={workspace} emojis={emojis} />
              </AnimBox>
            </div>
          );
        })}
      </Canvas>
    </div>
  );
};

export default memo(SlideView);

// 이 쪽에서 애니메이션이 있는 요소 수
export const animCount = (slide: Slide) => slide.elements.filter((e) => e.anim && e.anim !== 'none').length;
