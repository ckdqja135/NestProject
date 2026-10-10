import { Overlay, ResultBox, ResultItem, SearchForm } from '@components/SearchModal/styles';
import { IChannel, IChat, IDM, ISearchResult, IUser } from '@typings/db';
import fetcher from '@utils/fetcher';
import useSWR from 'swr';
import { Filters, MoreButton } from '@components/SearchModal/styles';
import getErrorMessage from '@utils/getErrorMessage';
import { describeContent } from '@utils/gif';
import axios from 'axios';
import dayjs from 'dayjs';
import React, { FC, useCallback, useState } from 'react';
import { useHistory } from 'react-router-dom';

interface Props {
  workspace?: string;
  myId?: number;
}

// 멘션 마크업(@[닉네임](id))을 읽기 좋은 형태로 바꾸고, 검색어를 강조한다
const highlight = (content: string, keyword: string) => {
  const text = describeContent(content).replace(/@\[(.+?)]\((\d+?)\)/g, '@$1');
  const lower = text.toLowerCase();
  const target = keyword.toLowerCase();
  const parts: (string | JSX.Element)[] = [];
  let start = 0;
  let index = lower.indexOf(target);
  while (index !== -1 && target) {
    parts.push(text.slice(start, index));
    parts.push(<mark key={index}>{text.slice(index, index + target.length)}</mark>);
    start = index + target.length;
    index = lower.indexOf(target, start);
  }
  parts.push(text.slice(start));
  return parts;
};

// 상단 검색창 + 검색 결과 창
const SearchModal: FC<Props> = ({ workspace, myId }) => {
  const history = useHistory();
  const [keyword, setKeyword] = useState('');
  const [searched, setSearched] = useState('');
  const [result, setResult] = useState<ISearchResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 검색 필터 (채널, 보낸 사람, 기간)와 페이지
  const [filters, setFilters] = useState({ channel: '', from: '', after: '', before: '' });
  const [page, setPage] = useState(1);
  const { data: channels } = useSWR<IChannel[]>(
    result && workspace ? `/api/workspaces/${workspace}/channels` : null,
    fetcher,
  );
  const { data: members } = useSWR<IUser[]>(
    result && workspace ? `/api/workspaces/${workspace}/members` : null,
    fetcher,
  );

  const run = useCallback(
    (q: string, nextFilters: typeof filters, nextPage: number) => {
      if (!workspace) {
        return;
      }
      setLoading(true);
      setError('');
      setSearched(q);
      setPage(nextPage);
      const params: Record<string, string | number> = { page: nextPage };
      if (q) {
        params.q = q;
      }
      Object.entries(nextFilters).forEach(([key, value]) => {
        if (value) {
          params[key] = value;
        }
      });
      axios
        .get<ISearchResult>(`/api/workspaces/${workspace}/search`, { params })
        .then(({ data }) =>
          // 다음 페이지면 이어 붙인다
          setResult((prev) =>
            nextPage > 1 && prev
              ? { ...data, chats: [...prev.chats, ...data.chats], dms: [...prev.dms, ...data.dms] }
              : data,
          ),
        )
        .catch((err) => {
          setResult({ chats: [], dms: [] });
          setError(getErrorMessage(err));
        })
        .finally(() => setLoading(false));
    },
    [workspace],
  );

  const onSubmit = useCallback(
    (e) => {
      e.preventDefault();
      const q = keyword.trim();
      if (!q) {
        return;
      }
      run(q, filters, 1);
    },
    [keyword, filters, run],
  );

  const onChangeFilter = (key: keyof typeof filters, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    if (searched || Object.values(next).some(Boolean)) {
      run(searched, next, 1);
    }
  };

  const onClose = useCallback(() => {
    setResult(null);
    setSearched('');
    setFilters({ channel: '', from: '', after: '', before: '' });
    setPage(1);
  }, []);

  const onClickChat = useCallback(
    (chat: IChat) => {
      onClose();
      // 스레드 답글이면 원본 메시지로 이동한 뒤 스레드를 열어 답글을 보여준다
      const query = chat.ParentId ? `message=${chat.ParentId}&reply=${chat.id}` : `message=${chat.id}`;
      history.push(`/workspace/${workspace}/channel/${chat.Channel.name}?${query}`);
    },
    [history, workspace, onClose],
  );

  const onClickDM = useCallback(
    (dm: IDM) => {
      onClose();
      const otherId = dm.SenderId === myId ? dm.ReceiverId : dm.SenderId;
      history.push(`/workspace/${workspace}/dm/${otherId}?message=${dm.id}`);
    },
    [history, workspace, myId, onClose],
  );

  if (!workspace) {
    return null;
  }

  const total = result ? result.chats.length + result.dms.length : 0;

  return (
    <>
      <SearchForm onSubmit={onSubmit} role="search">
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="메시지 검색"
          aria-label="메시지 검색"
        />
      </SearchForm>
      {(result || loading) && (
        <Overlay onClick={onClose}>
          <ResultBox onClick={(e) => e.stopPropagation()} role="dialog" aria-label="검색 결과">
            <header>
              <span>
                {loading
                  ? '검색 중...'
                  : `${searched ? `"${searched}" ` : ''}검색 결과 ${total}건${
                      result?.hasMoreChats || result?.hasMoreDms ? '+' : ''
                    }`}
              </span>
              <button type="button" onClick={onClose} aria-label="검색 결과 닫기">
                &times;
              </button>
            </header>
            <Filters>
              <select
                value={filters.channel}
                onChange={(e) => onChangeFilter('channel', e.target.value)}
                aria-label="채널"
              >
                <option value="">모든 채널·DM</option>
                {channels?.map((c) => (
                  <option key={c.id} value={c.name}>
                    #{c.name}
                  </option>
                ))}
              </select>
              <select
                value={filters.from}
                onChange={(e) => onChangeFilter('from', e.target.value)}
                aria-label="보낸 사람"
              >
                <option value="">보낸 사람 전체</option>
                {members?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nickname}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={filters.after}
                onChange={(e) => onChangeFilter('after', e.target.value)}
                aria-label="시작 날짜"
              />
              <span>~</span>
              <input
                type="date"
                value={filters.before}
                onChange={(e) => onChangeFilter('before', e.target.value)}
                aria-label="끝 날짜"
              />
            </Filters>
            {result && (
              <div>
                {error && <p className="empty">{error}</p>}
                <h3>채널 메시지 ({result.chats.length})</h3>
                {result.chats.length === 0 && <p className="empty">일치하는 채널 메시지가 없습니다.</p>}
                {result.chats.map((chat) => (
                  <ResultItem key={`c${chat.id}`} type="button" onClick={() => onClickChat(chat)}>
                    <div className="meta">
                      <b>#{chat.Channel.name}</b> · {chat.User.nickname} ·{' '}
                      {dayjs(chat.createdAt).format('YYYY-MM-DD h:mm A')}
                      {chat.ParentId ? ' · 스레드 답글' : ''}
                    </div>
                    <div className="content">{highlight(chat.content, searched)}</div>
                  </ResultItem>
                ))}
                {!filters.channel && <h3>다이렉트 메시지 ({result.dms.length})</h3>}
                {!filters.channel && result.dms.length === 0 && <p className="empty">일치하는 DM이 없습니다.</p>}
                {result.dms.map((dm) => (
                  <ResultItem key={`d${dm.id}`} type="button" onClick={() => onClickDM(dm)}>
                    <div className="meta">
                      <b>
                        {dm.Sender.nickname} → {dm.Receiver.nickname}
                      </b>{' '}
                      · {dayjs(dm.createdAt).format('YYYY-MM-DD h:mm A')}
                    </div>
                    <div className="content">{highlight(dm.content, searched)}</div>
                  </ResultItem>
                ))}
                {(result.hasMoreChats || result.hasMoreDms) && (
                  <MoreButton type="button" disabled={loading} onClick={() => run(searched, filters, page + 1)}>
                    {loading ? '불러오는 중...' : '더 보기'}
                  </MoreButton>
                )}
              </div>
            )}
          </ResultBox>
        </Overlay>
      )}
    </>
  );
};

export default SearchModal;
