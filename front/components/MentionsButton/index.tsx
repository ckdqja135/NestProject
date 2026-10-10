import { BellButton, Dropdown, MentionItem, Wrapper } from '@components/MentionsButton/styles';
import useMentions from '@hooks/useMentions';
import { IMention } from '@typings/db';
import { notificationPermission, previewText, requestNotificationPermission } from '@utils/notify';
import axios from 'axios';
import dayjs from 'dayjs';
import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';

interface Props {
  workspace: string;
}

// 상단 바의 멘션 버튼: 안 읽은 멘션 수, 멘션 목록, 브라우저 알림 켜기
const MentionsButton: FC<Props> = ({ workspace }) => {
  const history = useHistory();
  const { data } = useMentions(workspace);
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState(notificationPermission());
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
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

  const onClickMention = useCallback(
    (mention: IMention) => {
      setOpen(false);
      // 채널에 들어가면 그 채널의 멘션은 읽음 처리된다. 멘션된 메시지 위치로 이동 (스레드 답글이면 스레드를 열어서)
      const query = mention.Chat.ParentId
        ? `message=${mention.Chat.ParentId}&reply=${mention.Chat.id}`
        : `message=${mention.Chat.id}`;
      history.push(`/workspace/${workspace}/channel/${mention.Chat.Channel.name}?${query}`);
    },
    [history, workspace],
  );

  const onReadAll = useCallback(() => {
    axios.post(`/api/workspaces/${workspace}/mentions/read`, {}).catch(() => undefined);
  }, [workspace]);

  const onEnableNotification = useCallback(() => {
    requestNotificationPermission().then((result) => setPermission(result));
  }, []);

  const unread = data?.unreadTotal || 0;

  return (
    <Wrapper ref={wrapperRef}>
      <BellButton
        type="button"
        className={open ? 'active' : undefined}
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `멘션 ${unread}개 안 읽음` : '멘션'}
        aria-expanded={open}
        title="멘션"
      >
        🔔
        {unread > 0 && <span className="count">{unread > 99 ? '99+' : unread}</span>}
      </BellButton>
      {open && (
        <Dropdown role="dialog" aria-label="멘션">
          <header>
            <span>멘션</span>
            {unread > 0 && (
              <button type="button" onClick={onReadAll}>
                모두 읽음
              </button>
            )}
          </header>
          {permission === 'default' && (
            <div className="notice">
              <span>다른 탭을 보고 있을 때도 멘션과 DM 알림을 받으세요.</span>
              <button type="button" onClick={onEnableNotification}>
                브라우저 알림 켜기
              </button>
            </div>
          )}
          <div className="list">
            {!data && <p className="empty">불러오는 중...</p>}
            {data?.items.length === 0 && <p className="empty">아직 받은 멘션이 없습니다.</p>}
            {data?.items.map((mention) => (
              <MentionItem
                key={mention.id}
                type="button"
                className={mention.readAt ? undefined : 'unread'}
                onClick={() => onClickMention(mention)}
              >
                <div className="meta">
                  <b>{mention.Chat.User?.nickname}</b> · #{mention.Chat.Channel.name}
                  {mention.Chat.ParentId ? ' · 스레드' : ''} · {dayjs(mention.createdAt).format('M/D h:mm A')}
                </div>
                <div className="content">{previewText(mention.Chat.content)}</div>
              </MentionItem>
            ))}
          </div>
        </Dropdown>
      )}
    </Wrapper>
  );
};

export default MentionsButton;
