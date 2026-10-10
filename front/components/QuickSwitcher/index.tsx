import Modal from '@components/Modal';
import { IChannel, IUser } from '@typings/db';
import { avatarUrl } from '@utils/avatar';
import fetcher from '@utils/fetcher';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import useSWR from 'swr';
import { ResultList, SearchInput } from './styles';

const MAX_RESULTS = 10;

interface Props {
  show: boolean;
  workspace: string;
  myId: number;
  onCloseModal: () => void;
}

type Item = { key: string; label: string; path: string; hint: string; icon: React.ReactNode };

// 빠른 이동 (Ctrl/⌘ + K): 채널이나 사람 이름을 쳐서 바로 이동
const QuickSwitcher: FC<Props> = ({ show, workspace, myId, onCloseModal }) => {
  const history = useHistory();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const { data: channels } = useSWR<IChannel[]>(show ? `/api/workspaces/${workspace}/channels` : null, fetcher);
  const { data: members } = useSWR<IUser[]>(show ? `/api/workspaces/${workspace}/members` : null, fetcher);

  useEffect(() => {
    if (show) {
      setQuery('');
      setActive(0);
    }
  }, [show]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all: Item[] = [
      ...(channels || []).map((c) => ({
        key: `c${c.id}`,
        label: c.name,
        path: `/workspace/${workspace}/channel/${c.name}`,
        hint: c.archived ? '보관된 채널' : '채널',
        icon: <span className="icon">{c.private ? '🔒' : '#'}</span>,
      })),
      ...(members || []).map((m) => ({
        key: `u${m.id}`,
        label: m.id === myId ? `${m.nickname} (나)` : m.nickname,
        path: `/workspace/${workspace}/dm/${m.id}`,
        hint: 'DM',
        icon: <img src={avatarUrl(m, 20)} alt="" />,
      })),
    ];
    const matched = q ? all.filter((item) => item.label.toLowerCase().includes(q)) : all;
    // 이름이 검색어로 시작하는 것을 먼저
    return matched
      .sort((a, b) => Number(b.label.toLowerCase().startsWith(q)) - Number(a.label.toLowerCase().startsWith(q)))
      .slice(0, MAX_RESULTS);
  }, [query, channels, members, workspace, myId]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const go = (item?: Item) => {
    if (item) {
      onCloseModal();
      history.push(item.path);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) {
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(items[active]);
    }
  };

  return (
    <Modal
      show={show}
      onCloseModal={onCloseModal}
      title="빠른 이동"
      description="채널이나 사람 이름을 입력하세요. ↑↓ 로 고르고 Enter"
    >
      <SearchInput
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="어디로 갈까요?"
        aria-label="이동할 채널 또는 사람"
        role="combobox"
        aria-expanded
        aria-controls="quick-switcher-list"
        aria-activedescendant={items[active] ? `qs-${items[active].key}` : undefined}
      />
      <ResultList id="quick-switcher-list" role="listbox">
        {(channels || members) && items.length === 0 && <li className="empty">일치하는 채널이나 사람이 없습니다.</li>}
        {items.map((item, index) => (
          <li key={item.key}>
            <button
              type="button"
              id={`qs-${item.key}`}
              role="option"
              aria-selected={index === active}
              className={index === active ? 'active' : undefined}
              onMouseEnter={() => setActive(index)}
              onClick={() => go(item)}
            >
              {item.icon}
              <span>{item.label}</span>
              <small>{item.hint}</small>
            </button>
          </li>
        ))}
      </ResultList>
    </Modal>
  );
};

export default QuickSwitcher;
