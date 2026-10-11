import useSocket from '@hooks/useSocket';
import { ICustomEmoji } from '@typings/db';
import fetcher from '@utils/fetcher';
import { useEffect, useMemo } from 'react';
import useSWR from 'swr';

// 워크스페이스 커스텀 이모지 (:이름: → 그림). watch=false 면 (메시지마다 쓰는 경우) 캐시만 읽는다
export default function useCustomEmojis(workspace?: string, watch = true) {
  const [socket] = useSocket(watch ? workspace : undefined);
  const { data, mutate } = useSWR<ICustomEmoji[]>(
    workspace ? `/api/workspaces/${workspace}/emojis` : null,
    fetcher,
    watch
      ? { revalidateOnFocus: false }
      : { revalidateOnMount: false, revalidateOnFocus: false, revalidateOnReconnect: false },
  );
  useEffect(() => {
    if (!watch) {
      return undefined;
    }
    const refresh = () => mutate();
    socket?.on('emojisChanged', refresh);
    return () => {
      socket?.off('emojisChanged', refresh);
    };
  }, [watch, socket, mutate]);
  const map = useMemo(() => Object.fromEntries((data || []).map((e) => [e.name, e.image])), [data]);
  return { emojis: data, map };
}
