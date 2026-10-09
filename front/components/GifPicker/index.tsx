import { GifButton, Grid, Message, Popover, Wrapper } from '@components/GifPicker/styles';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';

interface GifItem {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
}

interface Props {
  onSelect: (url: string) => void;
  placement?: 'up-left' | 'up-right';
}

// GIF 검색 피커: 검색어가 없으면 인기 GIF, 입력하면 잠시 후 자동 검색
const GifPicker: FC<Props> = ({ onSelect, placement = 'up-left' }) => {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [gifs, setGifs] = useState<GifItem[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);
  const { data: status } = useSWR<{ enabled: boolean }>(open ? '/api/gifs/status' : null, fetcher);

  const search = useCallback((q: string) => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError('');
    axios
      .get<GifItem[]>('/api/gifs', { params: q ? { q } : {} })
      .then(({ data }) => {
        if (requestId === requestRef.current) {
          setGifs(data);
        }
      })
      .catch((err) => {
        if (requestId === requestRef.current) {
          setGifs([]);
          setError(getErrorMessage(err));
        }
      })
      .finally(() => {
        if (requestId === requestRef.current) {
          setLoading(false);
        }
      });
  }, []);

  // 입력이 멈추고 400ms 뒤 검색
  useEffect(() => {
    if (!open || !status?.enabled) {
      return;
    }
    const timer = setTimeout(() => search(keyword.trim()), keyword ? 400 : 0);
    return () => clearTimeout(timer);
  }, [open, status?.enabled, keyword, search]);

  // 바깥을 누르거나 Esc 를 누르면 닫는다
  useEffect(() => {
    if (!open) {
      return;
    }
    const onMouseDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const onPick = useCallback(
    (gif: GifItem) => {
      onSelect(gif.url);
      setOpen(false);
      setKeyword('');
    },
    [onSelect],
  );

  return (
    <Wrapper ref={wrapperRef}>
      <GifButton
        type="button"
        className={open ? 'active' : undefined}
        onClick={() => setOpen((v) => !v)}
        aria-label="GIF 검색"
        aria-expanded={open}
        title="GIF 검색"
      >
        GIF
      </GifButton>
      {open && (
        <Popover
          role="dialog"
          aria-label="GIF 검색"
          style={placement === 'up-right' ? { left: 'auto', right: 0 } : undefined}
        >
          <form onSubmit={(e) => e.preventDefault()}>
            <input
              autoFocus
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="GIPHY에서 GIF 검색"
              aria-label="GIF 검색어"
              disabled={status && !status.enabled}
            />
          </form>
          <Grid>
            {status && !status.enabled && (
              <Message>
                GIF 검색이 설정되지 않았습니다.
                <br />
                서버 <code>.env</code>에 <code>GIPHY_API_KEY</code>를 넣고 재시작해주세요.
              </Message>
            )}
            {status?.enabled && error && <Message>{error}</Message>}
            {status?.enabled && !error && loading && !gifs?.length && <Message>불러오는 중...</Message>}
            {status?.enabled && !error && !loading && gifs?.length === 0 && <Message>검색 결과가 없습니다.</Message>}
            {gifs?.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => onPick(gif)}
                title={gif.title}
                aria-label={gif.title || 'GIF'}
              >
                <img src={gif.previewUrl} alt={gif.title} loading="lazy" />
              </button>
            ))}
          </Grid>
          <footer>Powered by GIPHY</footer>
        </Popover>
      )}
    </Wrapper>
  );
};

export default GifPicker;
