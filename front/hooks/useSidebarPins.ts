import useSocket from '@hooks/useSocket';
import { IUser } from '@typings/db';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import useSWR from 'swr';

export type SidebarPinKind = 'channel' | 'dm' | 'thread';

export interface ISidebarPin {
  id: number;
  kind: SidebarPinKind;
  position: number;
  channel: { id: number; name: string; private: boolean; archived: boolean } | null;
  user: IUser | null;
  thread: {
    id: number;
    channel: string;
    author: string | null;
    preview: string;
    replyCount: number;
  } | null;
}

export const pinTargetId = (pin: ISidebarPin) =>
  pin.kind === 'channel' ? pin.channel!.id : pin.kind === 'dm' ? pin.user!.id : pin.thread!.id;

// 사이드바 맨 위에 고정한 채널·DM·스레드. 다른 기기에서 바꿔도 바로 맞춘다
const useSidebarPins = (workspace?: string) => {
  const key = workspace ? `/api/workspaces/${workspace}/sidebar-pins` : null;
  const { data, mutate } = useSWR<ISidebarPin[]>(key, fetcher);
  const [socket] = useSocket(workspace);
  useEffect(() => {
    const onChanged = () => mutate();
    socket?.on('sidebarPinsChanged', onChanged);
    return () => {
      socket?.off('sidebarPinsChanged', onChanged);
    };
  }, [socket, mutate]);

  const pins = useMemo(() => data || [], [data]);
  const isPinned = useCallback(
    (kind: SidebarPinKind, id: number) => pins.some((p) => p.kind === kind && pinTargetId(p) === id),
    [pins],
  );
  const setPinned = useCallback(
    (kind: SidebarPinKind, id: number, pinned: boolean) => {
      if (!workspace) return Promise.resolve();
      const url = `/api/workspaces/${workspace}/sidebar-pins/${kind}/${id}`;
      return (pinned ? axios.put(url) : axios.delete(url))
        .then(() => mutate())
        .catch((error) => {
          toast.error(getErrorMessage(error), { position: 'bottom-center' });
        });
    },
    [workspace, mutate],
  );
  const reorder = useCallback(
    (ids: number[]) => {
      if (!workspace) return;
      const byId = new Map(pins.map((p) => [p.id, p]));
      mutate(ids.map((id) => byId.get(id)!).filter(Boolean), false);
      axios
        .put(`/api/workspaces/${workspace}/sidebar-pins/order`, { ids })
        .then(() => mutate())
        .catch((error) => toast.error(getErrorMessage(error), { position: 'bottom-center' }));
    },
    [workspace, pins, mutate],
  );
  return { pins, loaded: !!data, isPinned, setPinned, reorder };
};

export default useSidebarPins;
