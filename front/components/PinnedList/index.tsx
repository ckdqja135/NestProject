import { CollapseButton } from '@components/DMList/styles';
import EachChannel from '@components/EachChannel';
import EachDM from '@components/EachDM';
import useMentions from '@hooks/useMentions';
import useOnlineList from '@hooks/useOnlineList';
import useSidebarPins, { ISidebarPin, pinTargetId } from '@hooks/useSidebarPins';
import { IChannel, IUser, IUserWithOnline } from '@typings/db';
import fetcher from '@utils/fetcher';
import { plainMentions } from '@utils/mention';
import { MessagesSquare, X } from 'lucide-react';
import React, { useState } from 'react';
import { useParams } from 'react-router';
import { NavLink, useLocation } from 'react-router-dom';
import useSWR from 'swr';
import { PinnedSection } from './styles';

const previewOf = (content: string) =>
  content.startsWith('file:')
    ? '파일'
    : content.startsWith('gif:')
    ? 'GIF'
    : plainMentions(content).replace(/\s+/g, ' ').trim() || '(내용 없음)';

// 사이드바 맨 위 '고정됨': 고정한 채널·DM·스레드. 끌어서 순서를 바꾸고, X 로 고정을 푼다
const PinnedList = () => {
  const { workspace } = useParams<{ workspace?: string }>();
  const location = useLocation();
  const { data: userData } = useSWR<IUser>('/api/users', fetcher, { dedupingInterval: 2000 });
  const { data: channelData } = useSWR<IChannel[]>(userData ? `/api/workspaces/${workspace}/channels` : null, fetcher);
  const { data: memberData } = useSWR<IUserWithOnline[]>(
    userData ? `/api/workspaces/${workspace}/members` : null,
    fetcher,
  );
  const { data: mentions } = useMentions(workspace);
  const onlineList = useOnlineList(workspace);
  const { pins, setPinned, reorder } = useSidebarPins(workspace);
  const [collapse, setCollapse] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);

  if (!pins.length) {
    return null;
  }

  const onDrop = (target: ISidebarPin) => {
    if (dragId === null || dragId === target.id) return;
    const ids = pins.map((p) => p.id).filter((id) => id !== dragId);
    ids.splice(ids.indexOf(target.id), 0, dragId);
    reorder(ids);
  };

  const renderItem = (pin: ISidebarPin) => {
    if (pin.kind === 'channel') {
      const channel = channelData?.find((c) => c.id === pin.channel?.id);
      return channel ? <EachChannel channel={channel} mentionCount={mentions?.unreadByChannel[channel.id]} /> : null;
    }
    if (pin.kind === 'dm') {
      const member = memberData?.find((m) => m.id === pin.user?.id);
      return member ? <EachDM member={member} isOnline={onlineList.includes(member.id)} /> : null;
    }
    const thread = pin.thread!;
    const path = `/workspace/${workspace}/channel/${thread.channel}`;
    return (
      <NavLink
        to={`${path}?message=${thread.id}&thread=1`}
        isActive={() => false}
        className={location.pathname === path ? 'thread-link here' : 'thread-link'}
        title={`#${thread.channel} 스레드: ${previewOf(thread.preview)}`}
      >
        <MessagesSquare size={13} className="ch-icon" />
        <span className="thread-text">
          <span className="t">{previewOf(thread.preview)}</span>
          <small>
            #{thread.channel}
            {thread.replyCount > 0 && ` · 답글 ${thread.replyCount}`}
          </small>
        </span>
      </NavLink>
    );
  };

  return (
    <PinnedSection aria-label="고정한 대화">
      <h2>
        <CollapseButton collapse={collapse} onClick={() => setCollapse((v) => !v)}>
          <i
            className="c-icon p-channel_sidebar__section_heading_expand p-channel_sidebar__section_heading_expand--show_more_feature c-icon--caret-right c-icon--inherit c-icon--inline"
            aria-hidden="true"
          />
        </CollapseButton>
        <span>고정됨</span>
      </h2>
      {!collapse &&
        pins.map((pin) => {
          const item = renderItem(pin);
          if (!item) return null;
          const label =
            pin.kind === 'channel'
              ? `#${pin.channel?.name}`
              : pin.kind === 'dm'
              ? pin.user?.nickname
              : `#${pin.thread?.channel} 스레드`;
          return (
            <div
              key={pin.id}
              className={`pin-item${overId === pin.id && dragId !== pin.id ? ' drop' : ''}${
                dragId === pin.id ? ' dragging' : ''
              }`}
              draggable
              onDragStart={(e) => {
                setDragId(pin.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                if (dragId === null) return;
                e.preventDefault();
                setOverId(pin.id);
              }}
              onDragLeave={() => setOverId((cur) => (cur === pin.id ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                onDrop(pin);
                setDragId(null);
                setOverId(null);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
            >
              {item}
              <button
                type="button"
                className="unpin"
                title="고정 풀기"
                aria-label={`${label} 고정 풀기`}
                onClick={() => setPinned(pin.kind, pinTargetId(pin), false)}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
    </PinnedSection>
  );
};

export default PinnedList;
