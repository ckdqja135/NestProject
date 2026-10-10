import styled from '@emotion/styled';
import { BellButton, Dropdown, MentionItem, Wrapper } from '@components/MentionsButton/styles';
import useSaved, { useToggleSaved } from '@hooks/useSaved';
import { ISavedItem } from '@typings/db';
import { previewText } from '@utils/notify';
import dayjs from 'dayjs';
import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';

// 🔔 멘션 버튼 왼쪽에 놓는다
const SavedWrapper = styled(Wrapper)`
  right: 96px;
`;

interface Props {
  workspace: string;
  myId: number;
}

// 상단 바의 🔖 버튼: 나중에 보려고 저장한 메시지 목록
const SavedButton: FC<Props> = ({ workspace, myId }) => {
  const history = useHistory();
  const { data } = useSaved(workspace);
  const toggleSaved = useToggleSaved(workspace);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

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

  // 저장한 메시지 위치로 이동 (스레드 답글이면 스레드를 열어서)
  const onClickItem = useCallback(
    (item: ISavedItem) => {
      setOpen(false);
      if (item.Chat) {
        const query = item.Chat.ParentId
          ? `message=${item.Chat.ParentId}&reply=${item.Chat.id}`
          : `message=${item.Chat.id}`;
        history.push(`/workspace/${workspace}/channel/${item.Chat.Channel.name}?${query}`);
      } else if (item.DM) {
        const otherId = item.DM.SenderId === myId ? item.DM.ReceiverId : item.DM.SenderId;
        history.push(`/workspace/${workspace}/dm/${otherId}?message=${item.DM.id}`);
      }
    },
    [history, workspace, myId],
  );

  const count = data?.length || 0;

  return (
    <SavedWrapper ref={wrapperRef}>
      <BellButton
        type="button"
        className={open ? 'active' : undefined}
        onClick={() => setOpen((v) => !v)}
        aria-label={`저장한 메시지 ${count}개`}
        aria-expanded={open}
        title="저장한 메시지"
      >
        🔖
      </BellButton>
      {open && (
        <Dropdown role="dialog" aria-label="저장한 메시지">
          <header>
            <span>저장한 메시지</span>
          </header>
          <div className="list">
            {!data && <p className="empty">불러오는 중...</p>}
            {data?.length === 0 && (
              <p className="empty">저장한 메시지가 없습니다. 메시지에 마우스를 올리고 🔖 를 눌러 저장하세요.</p>
            )}
            {data?.map((item) => {
              const message = item.Chat || item.DM;
              if (!message) {
                return null;
              }
              const author = item.Chat ? item.Chat.User : item.DM?.Sender;
              const where = item.Chat
                ? `#${item.Chat.Channel.name}${item.Chat.ParentId ? ' · 스레드' : ''}`
                : item.DM?.SenderId === myId
                ? `${item.DM?.Receiver?.nickname}님과의 DM`
                : `${item.DM?.Sender?.nickname}님과의 DM`;
              return (
                <MentionItem
                  key={item.id}
                  as="div"
                  role="button"
                  tabIndex={0}
                  onClick={() => onClickItem(item)}
                  onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && onClickItem(item)}
                >
                  <div className="meta">
                    <b>{author?.nickname}</b> · {where} · {dayjs(message.createdAt).format('M/D h:mm A')}
                    <button
                      type="button"
                      className="remove"
                      title="저장 취소"
                      aria-label="저장 취소"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSaved(item.Chat ? 'chats' : 'dms', message.id, true);
                      }}
                    >
                      &times;
                    </button>
                  </div>
                  <div className="content">{previewText(message.content)}</div>
                </MentionItem>
              );
            })}
          </div>
        </Dropdown>
      )}
    </SavedWrapper>
  );
};

export default SavedButton;
