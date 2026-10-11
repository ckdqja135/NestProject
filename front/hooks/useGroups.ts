import useSocket from '@hooks/useSocket';
import { IUserGroup } from '@typings/db';
import fetcher from '@utils/fetcher';
import { useEffect } from 'react';
import useSWR from 'swr';

// 워크스페이스의 사용자 그룹 목록 (누군가 그룹을 바꾸면 다시 불러온다)
export default function useGroups(workspace?: string) {
  const [socket] = useSocket(workspace);
  const swr = useSWR<IUserGroup[]>(workspace ? `/api/workspaces/${workspace}/groups` : null, fetcher);
  const { mutate } = swr;
  useEffect(() => {
    const refresh = () => mutate();
    socket?.on('groupsChanged', refresh);
    return () => {
      socket?.off('groupsChanged', refresh);
    };
  }, [socket, mutate]);
  return swr;
}
