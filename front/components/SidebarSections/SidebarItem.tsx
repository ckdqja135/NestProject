import useSidebarSections, { SectionItemKind } from '@hooks/useSidebarSections';
import React, { FC, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router';
import { ItemMenu } from './styles';

export const DRAG_TYPE = 'application/x-shlack-sidebar';
export const RENAME_SECTION_EVENT = 'shlack-rename-section';

// 사이드바의 채널·DM 한 줄: 끌어서 섹션에 넣고, 오른쪽 클릭으로 섹션을 고른다
const SidebarItem: FC<{ kind: SectionItemKind; id: number; label: string }> = ({ kind, id, label, children }) => {
  const { workspace } = useParams<{ workspace?: string }>();
  const { sections, sectionOf, move, create } = useSidebarSections(workspace);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const current = sectionOf(kind, id);

  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('blur', close);
    };
  }, [menu]);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ kind, id }));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {children}
      {menu &&
        createPortal(
          <ItemMenu role="menu" aria-label={`${label} 섹션`} style={{ left: menu.x, top: menu.y }}>
            <div className="title">섹션으로 옮기기</div>
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                role="menuitem"
                disabled={s.id === current}
                onClick={() => move(kind, id, s.id)}
              >
                {s.name}
                {s.id === current ? ' ✓' : ''}
              </button>
            ))}
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                create(`새 섹션 ${sections.length + 1}`).then((s) => {
                  move(kind, id, s.id);
                  // 만든 섹션의 이름을 바로 고칠 수 있게
                  window.dispatchEvent(new CustomEvent(RENAME_SECTION_EVENT, { detail: s.id }));
                })
              }
            >
              ＋ 새 섹션 만들기
            </button>
            {current !== null && (
              <button type="button" role="menuitem" onClick={() => move(kind, id, null)}>
                섹션에서 빼기
              </button>
            )}
          </ItemMenu>,
          document.body,
        )}
    </div>
  );
};

export default SidebarItem;
