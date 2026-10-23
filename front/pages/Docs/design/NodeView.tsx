import React, { FC, memo } from 'react';
import { childrenOf, DNode, FONT_FAMILY, pageKey, Snapshot } from './model';

// 캔버스 요소 그리기 (SVG). 좌표는 부모 프레임 기준이다.

const SHADOW = 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15))';

const paint = (color: string) => color || 'none';

const ArrowHead: FC<{ node: DNode }> = ({ node }) => {
  const angle = Math.atan2(node.h, node.w);
  const size = Math.max(10, node.strokeWidth * 4);
  const tip = { x: node.x + node.w, y: node.y + node.h };
  const wing = (delta: number) => ({
    x: tip.x - size * Math.cos(angle + delta),
    y: tip.y - size * Math.sin(angle + delta),
  });
  const a = wing(0.45);
  const b = wing(-0.45);
  return (
    <polyline
      points={`${a.x},${a.y} ${tip.x},${tip.y} ${b.x},${b.y}`}
      fill="none"
      stroke={paint(node.stroke)}
      strokeWidth={node.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
};

interface Props {
  id: string;
  snap: Snapshot;
  editing: string | null;
}

const Node: FC<Props> = ({ id, snap, editing }) => {
  const node = snap.nodes[id];
  if (!node || !node.visible) return null;
  const common = {
    'data-id': id,
    opacity: node.opacity < 1 ? node.opacity : undefined,
    style: {
      pointerEvents: node.locked ? ('none' as const) : undefined,
      filter: node.shadow ? SHADOW : undefined,
    },
  };
  const rotate = node.rotation ? `rotate(${node.rotation} ${node.x + node.w / 2} ${node.y + node.h / 2})` : undefined;

  if (node.type === 'frame') {
    const kids = childrenOf(snap, id);
    return (
      <g data-frame={id} transform={`translate(${node.x} ${node.y})`} opacity={common.opacity}>
        {node.clip && (
          <clipPath id={`clip-${id}`}>
            <rect width={node.w} height={node.h} rx={node.radius} />
          </clipPath>
        )}
        <rect
          data-id={id}
          className="frame-bg"
          width={node.w}
          height={node.h}
          rx={node.radius}
          fill={paint(node.fill)}
          style={{ ...common.style, pointerEvents: node.locked ? 'none' : 'all' }}
        />
        <g clipPath={node.clip ? `url(#clip-${id})` : undefined}>
          {kids.map((child) => (
            <Node key={child} id={child} snap={snap} editing={editing} />
          ))}
        </g>
        {node.stroke && (
          <rect
            width={node.w}
            height={node.h}
            rx={node.radius}
            fill="none"
            stroke={node.stroke}
            strokeWidth={node.strokeWidth}
            pointerEvents="none"
          />
        )}
      </g>
    );
  }

  if (node.type === 'rect') {
    return (
      <rect
        {...common}
        x={node.x}
        y={node.y}
        width={node.w}
        height={node.h}
        rx={node.radius}
        fill={paint(node.fill)}
        stroke={node.stroke || undefined}
        strokeWidth={node.stroke ? node.strokeWidth : undefined}
        transform={rotate}
        pointerEvents="all"
      />
    );
  }

  if (node.type === 'ellipse') {
    return (
      <ellipse
        {...common}
        cx={node.x + node.w / 2}
        cy={node.y + node.h / 2}
        rx={node.w / 2}
        ry={node.h / 2}
        fill={paint(node.fill)}
        stroke={node.stroke || undefined}
        strokeWidth={node.stroke ? node.strokeWidth : undefined}
        transform={rotate}
        pointerEvents="all"
      />
    );
  }

  if (node.type === 'line' || node.type === 'arrow') {
    return (
      <g {...common}>
        {/* 가는 선도 잡기 쉽게 보이지 않는 굵은 선을 깐다 */}
        <line
          x1={node.x}
          y1={node.y}
          x2={node.x + node.w}
          y2={node.y + node.h}
          stroke="transparent"
          strokeWidth={Math.max(12, node.strokeWidth + 8)}
          pointerEvents="stroke"
        />
        <line
          x1={node.x}
          y1={node.y}
          x2={node.x + node.w}
          y2={node.y + node.h}
          stroke={paint(node.stroke)}
          strokeWidth={node.strokeWidth}
          strokeLinecap="round"
        />
        {node.type === 'arrow' && <ArrowHead node={node} />}
      </g>
    );
  }

  // 글: 줄바꿈·한글이 자연스럽게 보이도록 HTML 로 그린다
  return (
    <foreignObject
      {...common}
      x={node.x}
      y={node.y}
      width={Math.max(1, node.w)}
      height={Math.max(1, node.h)}
      transform={rotate}
      style={{ ...common.style, overflow: 'visible', visibility: editing === id ? 'hidden' : undefined }}
    >
      <div
        className="design-text"
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: node.fontSize,
          fontWeight: node.fontWeight,
          lineHeight: node.lineHeight,
          color: node.fill || 'transparent',
          textAlign: node.align,
          whiteSpace: node.textMode === 'auto' ? 'pre' : 'pre-wrap',
          wordBreak: 'break-word',
          width: node.textMode === 'auto' ? 'max-content' : node.w,
        }}
      >
        {node.text}
      </div>
    </foreignObject>
  );
};

// 한 페이지의 요소 전부 (화면 이동·확대 때는 다시 그리지 않는다)
export const PageNodes: FC<{ snap: Snapshot; page: string; editing: string | null }> = memo(
  ({ snap, page, editing }) => (
    <>
      {childrenOf(snap, pageKey(page)).map((id) => (
        <Node key={id} id={id} snap={snap} editing={editing} />
      ))}
    </>
  ),
);

export default Node;
