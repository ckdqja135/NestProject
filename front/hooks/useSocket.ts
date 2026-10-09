import { useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// 배포 시에는 같은 서버(same origin)
const backUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3002';

const sockets: { [key: string]: Socket } = {};
const useSocket = (workspace?: string): [Socket | undefined, () => void] => {
  const disconnect = useCallback(() => {
    if (workspace && sockets[workspace]) {
      console.log('소켓 연결 끊음');
      sockets[workspace].disconnect();
      delete sockets[workspace];
    }
  }, [workspace]);
  if (!workspace) {
    return [undefined, disconnect];
  }
  if (!sockets[workspace]) {
    sockets[workspace] = io(`${backUrl}/ws-${workspace}`, {
      transports: ['websocket'],
      withCredentials: true, // 서버가 로그인 세션 쿠키로 사용자를 확인한다
    });
    console.info('create socket', workspace, sockets[workspace]);
    sockets[workspace].on('connect_error', (err) => {
      console.error(err);
      console.log(`connect_error due to ${err.message}`);
    });
  }

  return [sockets[workspace], disconnect];
};

export default useSocket;
