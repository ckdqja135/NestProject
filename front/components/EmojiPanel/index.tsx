import useCustomEmojis from '@hooks/useCustomEmojis';
import { EmojiGroup, loadEmojis } from '@utils/emojiData';
import { addRecentEmoji, getRecentEmojis } from '@utils/recentEmojis';
import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Panel } from './styles';

const GROUP_ICONS: Record<string, string> = {
  'smileys-emotion': '😀',
  'people-body': '👋',
  'animals-nature': '🐻',
  'food-drink': '🍔',
  'travel-places': '✈️',
  activities: '⚽',
  objects: '💡',
  symbols: '❤️',
  flags: '🏳️',
};

interface Props {
  // 고른 이모지 (커스텀 이모지면 :이름:)
  onPick: (emoji: string) => void;
}

// 이모지 고르기: 검색(한국어 이름·검색어), 최근 쓴 것, 커스텀 이모지, 분류별
const EmojiPanel: FC<Props> = ({ onPick }) => {
  const { workspace } = useParams<{ workspace?: string }>();
  const { emojis: customEmojis, map: customMap } = useCustomEmojis(workspace);
  const [groups, setGroups] = useState<EmojiGroup[] | null>(null);
  const [query, setQuery] = useState('');
  const [recent] = useState(getRecentEmojis);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    loadEmojis()
      .then((loaded) => alive && setGroups(loaded))
      .catch(() => alive && setGroups([]));
    return () => {
      alive = false;
    };
  }, []);

  const pick = (emoji: string) => {
    addRecentEmoji(emoji);
    onPick(emoji);
  };

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q || !groups) {
      return null;
    }
    const unicode = groups
      .flatMap((g) => g.emojis)
      .filter((e) => e.label.includes(q) || e.tags.some((t) => t.toLowerCase().includes(q)))
      .slice(0, 80)
      .map((e) => ({ key: e.u, title: e.label, emoji: e.u }));
    const custom = (customEmojis || [])
      .filter((e) => e.name.includes(q))
      .map((e) => ({ key: `:${e.name}:`, title: `:${e.name}:`, emoji: `:${e.name}:` }));
    return [...custom, ...unicode];
  }, [q, groups, customEmojis]);

  const renderEmoji = (emoji: string) => {
    const custom = /^:([a-z0-9_-]+):$/.exec(emoji);
    return custom && customMap[custom[1]] ? <img src={customMap[custom[1]]} alt={emoji} /> : emoji;
  };

  const scrollTo = (key: string) =>
    bodyRef.current?.querySelector(`[data-group="${key}"]`)?.scrollIntoView({ block: 'start' });

  return (
    <Panel role="dialog" aria-label="이모지 고르기" onMouseDown={(e) => e.stopPropagation()}>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="이모지 검색 (예: 엄지, 하트, 고양이)"
        aria-label="이모지 검색"
      />
      {!q && (
        <div className="tabs">
          {(customEmojis?.length || 0) > 0 && (
            <button type="button" title="커스텀" onClick={() => scrollTo('custom')}>
              ⭐
            </button>
          )}
          {groups?.map((g) => (
            <button key={g.key} type="button" title={g.name} onClick={() => scrollTo(g.key)}>
              {GROUP_ICONS[g.key] || '•'}
            </button>
          ))}
        </div>
      )}
      <div className="body" ref={bodyRef}>
        {results ? (
          results.length ? (
            <div className="grid">
              {results.map((r) => (
                <button key={r.key} type="button" title={r.title} onClick={() => pick(r.emoji)}>
                  {renderEmoji(r.emoji)}
                </button>
              ))}
            </div>
          ) : (
            <p className="empty">찾는 이모지가 없습니다.</p>
          )
        ) : (
          <>
            {recent.length > 0 && (
              <>
                <h4>최근 쓴 이모지</h4>
                <div className="grid">
                  {recent.map((emoji) => (
                    <button key={emoji} type="button" onClick={() => pick(emoji)}>
                      {renderEmoji(emoji)}
                    </button>
                  ))}
                </div>
              </>
            )}
            {(customEmojis?.length || 0) > 0 && (
              <>
                <h4 data-group="custom">커스텀</h4>
                <div className="grid">
                  {customEmojis?.map((e) => (
                    <button key={e.id} type="button" title={`:${e.name}:`} onClick={() => pick(`:${e.name}:`)}>
                      <img src={e.image} alt={`:${e.name}:`} />
                    </button>
                  ))}
                </div>
              </>
            )}
            {!groups && <p className="empty">불러오는 중...</p>}
            {groups?.map((g) => (
              <React.Fragment key={g.key}>
                <h4 data-group={g.key}>{g.name}</h4>
                <div className="grid">
                  {g.emojis.map((e) => (
                    <button key={e.u} type="button" title={e.label} onClick={() => pick(e.u)}>
                      {e.u}
                    </button>
                  ))}
                </div>
              </React.Fragment>
            ))}
          </>
        )}
      </div>
    </Panel>
  );
};

export default EmojiPanel;
