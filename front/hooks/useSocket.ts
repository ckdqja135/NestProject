import { useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// 배포 시에는 같은 서버(same origin)
// 개발 중에는 백엔드(3002)에 직접 붙는다. 페이지와 같은 호스트를 써야 같은 로그인 쿠키가 실린다
const backUrl = process.env.NODE_ENV === 'production' ? '' : `http://${window.location.hostname}:3002`;

const sockets: { [key: string]: Socket } = {};
// 워크스페이스별 마지막 온라인 목록 (나중에 마운트된 화면도 바로 쓸 수 있게 캐시)
export const onlineLists: { [workspace: string]: number[] } = {};
const useSocket = (workspace?: string): [Socket | undefined, () => void] => {
  const disconnect = useCallback(() => {
    if (workspace && sockets[workspace]) {
      console.log('소켓 연결 끊음');
      sockets[workspace].disconnect();
      delete sockets[workspace];
      delete onlineLists[workspace];
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
    sockets[workspace].on('onlineList', (data: number[]) => {
      onlineLists[workspace] = data;
    });
    sockets[workspace].on('connect_error', (err) => {
      console.error(err);
      console.log(`connect_error due to ${err.message}`);
    });
  }

  return [sockets[workspace], disconnect];
};

export default useSocket;
