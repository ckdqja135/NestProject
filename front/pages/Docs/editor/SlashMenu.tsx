import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { SlashItem } from './slashItems';

export interface SlashMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface Props {
  items: SlashItem[];
  command: (item: SlashItem) => void;
}

// '/' 블록 목록. 위·아래 화살표로 고르고 Enter 로 넣는다
const SlashMenu = forwardRef<SlashMenuHandle, Props>(({ items, command }, ref) => {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (!items.length) return false;
      if (event.key === 'ArrowDown') {
        setIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowUp') {
        setIndex((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        command(items[index]);
        return true;
      }
      return false;
    },
  }));

  useEffect(() => {
    document.querySelector('.slash-menu .on')?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  return (
    <div className="slash-menu" role="listbox" aria-label="블록 넣기">
      {items.length === 0 ? (
        <div className="empty">맞는 블록이 없습니다</div>
      ) : (
        items.map((item, i) => (
          <button
            key={item.key}
            type="button"
            role="option"
            aria-selected={i === index}
            className={i === index ? 'on' : undefined}
            onMouseEnter={() => setIndex(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => command(item)}
          >
            <span className="icon">
              <item.Icon size={18} />
            </span>
            <span className="text">
              <b>{item.title}</b>
              <small>{item.description}</small>
            </span>
          </button>
        ))
      )}
    </div>
  );
});

export default SlashMenu;
