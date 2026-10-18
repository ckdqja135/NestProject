import styled from '@emotion/styled';
import { renderDocMarkdown } from '@utils/docMarkdown';
import React, { FC, memo } from 'react';
import { H, safeSrc, Slide, SlideElement, W } from './model';

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

  & .doc-table {
    border-collapse: collapse;

    & th,
    & td {
      padding: 0.2em 0.5em;
      border: 1px solid currentColor;
    }
  }
`;

const ShapeSvg: FC<{ el: SlideElement }> = ({ el }) => {
  const sw = el.strokeWidth ?? (el.stroke ? 2 : 0);
  const fill = el.fill || 'transparent';
  const stroke = el.stroke || 'none';
  const half = sw / 2;
  const w = el.w;
  const h = el.h;
  let shape: React.ReactNode;
  switch (el.shape) {
    case 'ellipse':
      shape = <ellipse cx={w / 2} cy={h / 2} rx={Math.max(0, w / 2 - half)} ry={Math.max(0, h / 2 - half)} />;
      break;
    case 'triangle':
      shape = <polygon points={`${w / 2},${half} ${w - half},${h - half} ${half},${h - half}`} />;
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
    case 'line':
      return (
        <svg width={w} height={h} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
          <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke={el.stroke || '#1d1c1d'} strokeWidth={el.strokeWidth || 3} />
        </svg>
      );
    case 'round':
      shape = (
        <rect x={half} y={half} width={Math.max(0, w - sw)} height={Math.max(0, h - sw)} rx={Math.min(w, h) * 0.15} />
      );
      break;
    default:
      shape = <rect x={half} y={half} width={Math.max(0, w - sw)} height={Math.max(0, h - sw)} />;
  }
  return (
    <svg
      width={w}
      height={h}
      style={{ position: 'absolute', inset: 0 }}
      fill={fill}
      stroke={stroke}
      strokeWidth={sw}
      aria-hidden="true"
    >
      {shape}
    </svg>
  );
};

const VALIGN = { top: 'flex-start', middle: 'center', bottom: 'flex-end' } as const;

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
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
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
  return (
    <>
      {el.type === 'shape' && <ShapeSvg el={el} />}
      {!hideText && el.text && el.shape !== 'line' && (
        <SlideText
          style={{
            position: 'relative',
            justifyContent: VALIGN[el.valign || (el.type === 'shape' ? 'middle' : 'top')],
            fontSize: el.fontSize || 24,
            fontWeight: el.bold ? 700 : undefined,
            fontStyle: el.italic ? 'italic' : undefined,
            color: el.color,
            textAlign: el.align || (el.type === 'shape' ? 'center' : 'left'),
          }}
        >
          <div>{renderDocMarkdown(el.text, workspace, emojis).nodes}</div>
        </SlideText>
      )}
    </>
  );
};

interface Props {
  slide: Slide;
  scale: number;
  workspace: string;
  emojis?: Record<string, string>;
}

// 슬라이드 한 쪽을 그린다 (목록 미리보기, 발표 모드)
const SlideView: FC<Props> = ({ slide, scale, workspace, emojis }) => (
  <div style={{ width: W * scale, height: H * scale, overflow: 'hidden' }}>
    <Canvas style={{ background: slide.background, transform: `scale(${scale})` }}>
      {slide.elements.map((el) => (
        <div key={el.id} style={{ position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h }}>
          <ElementBody el={el} workspace={workspace} emojis={emojis} />
        </div>
      ))}
    </Canvas>
  </div>
);

export default memo(SlideView);
