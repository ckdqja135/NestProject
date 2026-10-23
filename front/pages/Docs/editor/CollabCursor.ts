import { Extension } from '@tiptap/core';
import { yCursorPlugin } from 'y-prosemirror';
import { Awareness } from 'y-protocols/awareness';

// 다른 사람의 커서와 선택 영역 (이름표 포함). awareness 의 user 에 { name, color } 가 있어야 한다
const cursorBuilder = (user: { name?: string; color?: string }) => {
  const color = user.color || '#2f80ed';
  const cursor = document.createElement('span');
  cursor.className = 'collab-cursor';
  cursor.style.borderColor = color;
  const label = document.createElement('span');
  label.className = 'collab-cursor-label';
  label.style.backgroundColor = color;
  label.textContent = user.name || '';
  cursor.appendChild(label);
  return cursor;
};

const selectionBuilder = (user: { color?: string }) => ({
  style: `background-color: ${user.color || '#2f80ed'}33`,
  class: 'collab-selection',
});

const CollabCursor = Extension.create<{ awareness: Awareness | null }>({
  name: 'collabCursor',
  addOptions() {
    return { awareness: null };
  },
  addProseMirrorPlugins() {
    if (!this.options.awareness) return [];
    return [yCursorPlugin(this.options.awareness, { cursorBuilder, selectionBuilder })];
  },
});

export default CollabCursor;
