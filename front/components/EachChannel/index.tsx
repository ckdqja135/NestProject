import useSocket from '@hooks/useSocket';
import { IChannel, IChat, IUser } from '@typings/db';
import fetcher from '@utils/fetcher';
import React, { useEffect, useRef, VFC } from 'react';
import { useParams } from 'react-router';
import { NavLink, useLocation } from 'react-router-dom';
import useSWR from 'swr';

interface Props {
  channel: IChannel;
  mentionCount?: number; // 이 채널에서 나를 멘션한 안 읽은 메시지 수
}
const EachChannel: VFC<Props> = ({ channel, mentionCount = 0 }) => {
  const { workspace } = useParams<{ workspace?: string }>();
  const location = useLocation();
  const { data: userData } = useSWR<IUser>('/api/users', fetcher, {
    dedupingInterval: 2000, // 2초
  });
  const date = localStorage.getItem(`${workspace}-${channel.name}`) || 0;
  const { data: count, mutate } = useSWR<number>(
    userData ? `/api/workspaces/${workspace}/channels/${channel.name}/unreads?after=${date}` : null,
    fetcher,
  );

  const [socket] = useSocket(workspace);
  const isViewing = location.pathname === `/workspace/${workspace}/channel/${channel.name}`;
  const isViewingRef = useRef(isViewing);
  isViewingRef.current = isViewing;

  useEffect(() => {
    if (isViewing) {
      mutate(0);
    }
  }, [mutate, isViewing]);

  // 새 메시지가 오면 안 읽은 수를 실시간으로 올린다 (내 메시지, 스레드 답글 제외)
  useEffect(() => {
    const onMessage = (data: IChat) => {
      if (data.ChannelId === channel.id && !data.ParentId && data.UserId !== userData?.id && !isViewingRef.current) {
        mutate((prev) => (prev || 0) + 1, false);
      }
    };
    // 메시지가 삭제되면 안 읽은 수를 서버에서 다시 받는다
    const onDeleted = (data: { ChannelId: number }) => {
      if (data.ChannelId === channel.id && !isViewingRef.current) {
        mutate();
      }
    };
    socket?.on('message', onMessage);
    socket?.on('messageDeleted', onDeleted);
    return () => {
      socket?.off('message', onMessage);
      socket?.off('messageDeleted', onDeleted);
    };
  }, [socket, channel.id, userData?.id, mutate]);

  return (
    <NavLink key={channel.name} activeClassName="selected" to={`/workspace/${workspace}/channel/${channel.name}`}>
      <span className={count !== undefined && count > 0 ? 'bold' : undefined}>
        {channel.private ? '🔒' : '#'} {channel.name}
      </span>
      {mentionCount > 0 ? (
        <span className="count" title={`나를 멘션한 메시지 ${mentionCount}개`} aria-label={`멘션 ${mentionCount}개`}>
          {mentionCount}
        </span>
      ) : (
        count !== undefined &&
        count > 0 && (
          <span className="count muted" title={`안 읽은 메시지 ${count}개`}>
            {count}
          </span>
        )
      )}
    </NavLink>
  );
};

export default EachChannel;
