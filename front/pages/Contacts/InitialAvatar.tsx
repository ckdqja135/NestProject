import React, { FC } from 'react';

// 사진이 없는 외부 연락처: 이름 첫 글자를 색 동그라미에
const COLORS = ['#2f80ed', '#7c5cd6', '#12a06b', '#e8891d', '#d64a9b', '#17a2a8', '#e0405a'];

export const InitialAvatar: FC<{ name: string; size: number }> = ({ name, size }) => {
  const hash = Array.from(name).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const color = COLORS[hash % COLORS.length];
  return (
    <span
      className="avatar initial"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 60%, #17a2a8))`,
      }}
    >
      {name.trim().slice(0, 1) || '?'}
    </span>
  );
};
