import styled from '@emotion/styled';
import { BellButton, Dropdown, MentionItem, Wrapper } from '@components/MentionsButton/styles';
import useSocket from '@hooks/useSocket';
import { IChat, IThread } from '@typings/db';
import fetcher from '@utils/fetcher';
import { previewText } from '@utils/notify';
import { getThreadRead, subscribeThreadReads } from '@utils/threadReads';
import dayjs from 'dayjs';
import React, { FC, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import useSWR from 'swr';

// 🔖 버튼 왼쪽에 놓는다
const ThreadsWrapper = styled(Wrapper)`
  right: 136px;
`;

interface Props {
  workspace: string;
  myId: number;
}

// 상단 바의 🧵 버튼: 내가 참여한 스레드 모아 보기 (새 답글 수 표시)
const ThreadsButton: FC<Props> = ({ workspace, myId }) => {
  const history = useHistory();
  const [socket] = useSocket(workspace);
  const { data, mutate } = useSWR<IThread[]>(`/api/workspaces/${workspace}/threads`, fetcher);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // 스레드를 읽으면(패널을 열면) 새 답글 표시를 다시 계산한다
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribeThreadReads(rerender), []);

  // 답글이 오거나 지워지면 목록을 다시 불러온다
  useEffect(() => {
    const onMessage = (chat: IChat) => {
      if (chat.ParentId) {
        mutate();
      }
    };
    const onDeleted = () => mutate();
    socket?.on('message', onMessage);
    socket?.on('messageDeleted', onDeleted);
    return () => {
      socket?.off('message', onMessage);
      socket?.off('messageDeleted', onDeleted);
    };
  }, [socket, mutate]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onMouseDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const isUnread = (thread: IThread) =>
    thread.lastReply.UserId !== myId && new Date(thread.lastReply.createdAt).getTime() > getThreadRead(thread.id);
  const unread = data?.filter(isUnread).length || 0;

  const onClickThread = useCallback(
    (thread: IThread) => {
      setOpen(false);
      history.push(
        `/workspace/${workspace}/channel/${thread.Channel.name}?message=${thread.id}&reply=${thread.lastReply.id}`,
      );
    },
    [history, workspace],
  );

  return (
    <ThreadsWrapper ref={wrapperRef}>
      <BellButton
        type="button"
        className={open ? 'active' : undefined}
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `새 답글이 있는 스레드 ${unread}개` : '스레드'}
        aria-expanded={open}
        title="스레드"
      >
        🧵
        {unread > 0 && <span className="count">{unread > 99 ? '99+' : unread}</span>}
      </BellButton>
      {open && (
        <Dropdown role="dialog" aria-label="스레드">
          <header>
            <span>스레드</span>
          </header>
          <div className="list">
            {!data && <p className="empty">불러오는 중...</p>}
            {data?.length === 0 && (
              <p className="empty">참여한 스레드가 없습니다. 메시지에 💬 로 답글을 달아 보세요.</p>
            )}
            {data?.map((thread) => (
              <MentionItem
                key={thread.id}
                type="button"
                className={isUnread(thread) ? 'unread' : undefined}
                onClick={() => onClickThread(thread)}
              >
                <div className="meta">
                  <b>{thread.User?.nickname}</b> · #{thread.Channel.name} · 답글 {thread.replyCount}개
                </div>
                <div className="content">{previewText(thread.content)}</div>
                <div className="meta" style={{ marginTop: 4 }}>
                  ↳ <b>{thread.lastReply.User?.nickname}</b>: {previewText(thread.lastReply.content)} ·{' '}
                  {dayjs(thread.lastReply.createdAt).format('M/D h:mm A')}
                </div>
              </MentionItem>
            ))}
          </div>
        </Dropdown>
      )}
    </ThreadsWrapper>
  );
};

export default ThreadsButton;
