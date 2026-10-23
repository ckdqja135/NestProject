import { FilePlus2 } from 'lucide-react';
import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import DocIcon from '../DocIcon';

export interface PageItem {
  id: number | null; // null 이면 새로 만들기
  title: string;
  type: string;
}

export interface PageMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface Props {
  items: PageItem[];
  query: string;
  command: (item: PageItem) => void;
}

// '[[' 를 치면 뜨는 문서 고르기
const PageMenu = forwardRef<PageMenuHandle, Props>(({ items, query, command }, ref) => {
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
  return (
    <div className="slash-menu page-menu" role="listbox" aria-label="링크할 문서">
      <div className="menu-title">{query ? `‘${query}’ 문서 링크` : '링크할 문서를 찾아보세요'}</div>
      {items.map((item, i) => (
        <button
          key={item.id ?? 'new'}
          type="button"
          role="option"
          aria-selected={i === index}
          className={i === index ? 'on' : undefined}
          onMouseEnter={() => setIndex(i)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => command(item)}
        >
          <span className="icon">
            {item.id === null ? <FilePlus2 size={18} /> : <DocIcon type={item.type as 'doc'} size={18} />}
          </span>
          <span className="text">
            <b>{item.id === null ? `새 페이지 ‘${item.title}’ 만들기` : item.title}</b>
          </span>
        </button>
      ))}
    </div>
  );
});

export default PageMenu;
