import useSocket from '@hooks/useSocket';
import { ISavedItem } from '@typings/db';
import fetcher from '@utils/fetcher';
import axios from 'axios';
import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import useSWR, { mutate } from 'swr';
import getErrorMessage from '@utils/getErrorMessage';

export const savedKey = (workspace: string) => `/api/workspaces/${workspace}/saved`;

// 저장한 메시지 목록. 다른 탭에서 저장하거나 메시지가 지워지면 다시 불러온다.
// watch=false 면 (메시지마다 쓰는 경우) 캐시만 읽고 소켓 구독/요청은 하지 않는다.
export default function useSaved(workspace?: string, watch = true) {
  const [socket] = useSocket(watch ? workspace : undefined);
  const swr = useSWR<ISavedItem[]>(
    workspace ? savedKey(workspace) : null,
    fetcher,
    watch ? undefined : { revalidateOnMount: false, revalidateOnFocus: false, revalidateOnReconnect: false },
  );
  const { mutate: revalidate } = swr;

  useEffect(() => {
    if (!watch) {
      return undefined;
    }
    const refresh = () => revalidate();
    socket?.on('savedChanged', refresh);
    socket?.on('messageDeleted', refresh);
    socket?.on('dmDeleted', refresh);
    return () => {
      socket?.off('savedChanged', refresh);
      socket?.off('messageDeleted', refresh);
      socket?.off('dmDeleted', refresh);
    };
  }, [watch, socket, revalidate]);

  const ids = useMemo(() => {
    const chats = new Set<number>();
    const dms = new Set<number>();
    swr.data?.forEach((item) => {
      if (item.ChatId) {
        chats.add(item.ChatId);
      }
      if (item.DMId) {
        dms.add(item.DMId);
      }
    });
    return { chats, dms };
  }, [swr.data]);

  return { ...swr, ids };
}

// 저장/저장 취소 (목록은 서버의 savedChanged 이벤트와 아래 갱신으로 바로 반영)
export function useToggleSaved(workspace: string) {
  return useCallback(
    (kind: 'chats' | 'dms', id: number, saved: boolean) => {
      const url = `${savedKey(workspace)}/${kind}/${id}`;
      return (saved ? axios.delete(url) : axios.put(url))
        .then(() => {
          mutate(savedKey(workspace));
          toast.info(saved ? '저장을 취소했습니다.' : '메시지를 저장했습니다. 🔖 에서 모아 볼 수 있어요.', {
            position: 'bottom-center',
          });
        })
        .catch((error) => toast.error(getErrorMessage(error), { position: 'bottom-center' }));
    },
    [workspace],
  );
}
