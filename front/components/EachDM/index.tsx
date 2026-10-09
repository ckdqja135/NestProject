import useSocket from '@hooks/useSocket';
import { IDM, IUser } from '@typings/db';
import fetcher from '@utils/fetcher';
import React, { useEffect, useRef, VFC } from 'react';
import { useParams } from 'react-router';
import { NavLink, useLocation } from 'react-router-dom';
import useSWR from 'swr';

interface Props {
  member: IUser;
  isOnline: boolean;
}
const EachDM: VFC<Props> = ({ member, isOnline }) => {
  const { workspace } = useParams<{ workspace?: string }>();
  const location = useLocation();
  const { data: userData } = useSWR<IUser>('/api/users', fetcher, {
    dedupingInterval: 2000, // 2초
  });
  const date = localStorage.getItem(`${workspace}-${member.id}`) || 0;
  const { data: count, mutate } = useSWR<number>(
    userData ? `/api/workspaces/${workspace}/dms/${member.id}/unreads?after=${date}` : null,
    fetcher,
  );

  const [socket] = useSocket(workspace);
  const isViewing = location.pathname === `/workspace/${workspace}/dm/${member.id}`;
  const isViewingRef = useRef(isViewing);
  isViewingRef.current = isViewing;

  useEffect(() => {
    if (isViewing) {
      mutate(0);
    }
  }, [mutate, isViewing]);

  // 새 DM 이 오면 안 읽은 수를 실시간으로 올린다
  useEffect(() => {
    const onDM = (data: IDM) => {
      if (data.SenderId === member.id && data.ReceiverId === userData?.id && data.SenderId !== userData?.id) {
        if (!isViewingRef.current) {
          mutate((prev) => (prev || 0) + 1, false);
        }
      }
    };
    // 상대가 보낸 DM 이 삭제되면 안 읽은 수를 서버에서 다시 받는다
    const onDMDeleted = (data: { SenderId: number; ReceiverId: number }) => {
      if (data.SenderId === member.id && data.ReceiverId === userData?.id && !isViewingRef.current) {
        mutate();
      }
    };
    socket?.on('dm', onDM);
    socket?.on('dmDeleted', onDMDeleted);
    return () => {
      socket?.off('dm', onDM);
      socket?.off('dmDeleted', onDMDeleted);
    };
  }, [socket, member.id, userData?.id, mutate]);

  return (
    <NavLink key={member.id} activeClassName="selected" to={`/workspace/${workspace}/dm/${member.id}`}>
      <i
        className={`c-icon p-channel_sidebar__presence_icon p-channel_sidebar__presence_icon--dim_enabled c-presence ${
          isOnline ? 'c-presence--active c-icon--presence-online' : 'c-icon--presence-offline'
        }`}
        aria-hidden="true"
        data-qa="presence_indicator"
        data-qa-presence-self="false"
        data-qa-presence-active="false"
        data-qa-presence-dnd="false"
      />
      <span className={count && count > 0 ? 'bold' : undefined}>{member.nickname}</span>
      {member.id === userData?.id && <span> (나)</span>}
      {(count && count > 0 && <span className="count">{count}</span>) || null}
    </NavLink>
  );
};

export default EachDM;
