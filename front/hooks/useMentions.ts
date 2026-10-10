import useSocket from '@hooks/useSocket';
import { IMentionList } from '@typings/db';
import fetcher from '@utils/fetcher';
import { useEffect } from 'react';
import useSWR from 'swr';

// 내가 받은 멘션 목록과 채널별 안 읽은 멘션 수 (새 멘션/읽음 처리 시 자동 갱신)
const useMentions = (workspace?: string) => {
  const [socket] = useSocket(workspace);
  const swr = useSWR<IMentionList>(workspace ? `/api/workspaces/${workspace}/mentions` : null, fetcher);
  const { mutate } = swr;

  useEffect(() => {
    const refresh = () => mutate();
    socket?.on('mention', refresh);
    socket?.on('mentionsChanged', refresh);
    return () => {
      socket?.off('mention', refresh);
      socket?.off('mentionsChanged', refresh);
    };
  }, [socket, mutate]);

  return swr;
};

export default useMentions;
