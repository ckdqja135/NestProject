import { ITyping } from '@typings/db';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';

const EMIT_INTERVAL = 2000; // 입력 중 이벤트는 2초에 한 번만 보낸다
const SHOW_DURATION = 3000; // 마지막 이벤트 후 3초 동안 표시

interface Options {
  socket?: Socket;
  nickname?: string;
  channelId?: number; // 채널이면 채널 id
  receiverId?: number; // DM 이면 상대방 id
}

// 입력 중 표시: notifyTyping 으로 알리고, typingUsers 로 다른 사람들의 입력 상태를 받는다
const useTyping = ({ socket, nickname, channelId, receiverId }: Options) => {
  const [typingUsers, setTypingUsers] = useState<{ [userId: number]: string }>({});
  const lastEmitRef = useRef(0);
  const timersRef = useRef<{ [userId: number]: ReturnType<typeof setTimeout> }>({});

  const notifyTyping = useCallback(() => {
    if (!socket || !nickname || (!channelId && !receiverId)) {
      return;
    }
    const now = Date.now();
    if (now - lastEmitRef.current < EMIT_INTERVAL) {
      return;
    }
    lastEmitRef.current = now;
    socket.emit('typing', channelId ? { channelId, nickname } : { receiverId, nickname });
  }, [socket, nickname, channelId, receiverId]);

  useEffect(() => {
    const timers = timersRef.current;
    const onTyping = (data: ITyping) => {
      const isMine = channelId ? data.channelId === channelId : data.dm && data.userId === receiverId;
      if (!isMine) {
        return;
      }
      setTypingUsers((prev) => ({ ...prev, [data.userId]: data.nickname }));
      clearTimeout(timers[data.userId]);
      timers[data.userId] = setTimeout(() => {
        setTypingUsers((prev) => {
          const next = { ...prev };
          delete next[data.userId];
          return next;
        });
      }, SHOW_DURATION);
    };
    socket?.on('typing', onTyping);
    return () => {
      socket?.off('typing', onTyping);
      Object.values(timers).forEach(clearTimeout);
      setTypingUsers({});
    };
  }, [socket, channelId, receiverId]);

  // 메시지를 보낸 사람은 더 이상 입력 중이 아니므로 바로 지운다
  const clearTypingUser = useCallback((userId: number) => {
    clearTimeout(timersRef.current[userId]);
    setTypingUsers((prev) => {
      if (!(userId in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, []);

  return { typingUsers: Object.values(typingUsers), notifyTyping, clearTypingUser };
};

export default useTyping;
