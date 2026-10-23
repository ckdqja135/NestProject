import useSocket from '@hooks/useSocket';
import { useCallback, useEffect, useState } from 'react';

export interface AppReply {
  id: number;
  appName: string;
  text: string;
  error?: boolean;
}

let nextId = 1;

// 앱 명령의 "나에게만 보이는" 답 (이 대화에서 받은 것만). 앱이 늦게 답하면 소켓으로 온다
export default function useAppEphemeral(workspace: string | undefined, scope: { channel?: string; dmUserId?: number }) {
  const [socket] = useSocket(workspace);
  const [items, setItems] = useState<AppReply[]>([]);
  const { channel, dmUserId } = scope;
  const push = useCallback((reply: Omit<AppReply, 'id'>) => {
    nextId += 1;
    setItems((list) => [...list.slice(-4), { ...reply, id: nextId }]);
  }, []);
  const dismiss = useCallback((id: number) => setItems((list) => list.filter((r) => r.id !== id)), []);

  // 다른 대화로 옮기면 비운다
  useEffect(() => setItems([]), [channel, dmUserId]);
  useEffect(() => {
    const onReply = (data: Omit<AppReply, 'id'> & { channel?: string | null; dmUserId?: number | null }) => {
      const here = channel ? data.channel === channel : !!dmUserId && data.dmUserId === dmUserId;
      if (here) push({ appName: data.appName, text: data.text, error: data.error });
    };
    socket?.on('appEphemeral', onReply);
    return () => {
      socket?.off('appEphemeral', onReply);
    };
  }, [socket, channel, dmUserId, push]);

  return { items, push, dismiss };
}
