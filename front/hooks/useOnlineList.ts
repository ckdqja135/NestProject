import useSocket, { onlineLists } from '@hooks/useSocket';
import { useEffect, useState } from 'react';

// 현재 워크스페이스에서 온라인인 사용자 id 목록
const useOnlineList = (workspace?: string) => {
  const [socket] = useSocket(workspace);
  const [onlineList, setOnlineList] = useState<number[]>(() => (workspace && onlineLists[workspace]) || []);

  useEffect(() => {
    setOnlineList((workspace && onlineLists[workspace]) || []);
    const onOnlineList = (data: number[]) => setOnlineList(data);
    socket?.on('onlineList', onOnlineList);
    return () => {
      // 다른 화면의 리스너는 건드리지 않도록 내 리스너만 제거
      socket?.off('onlineList', onOnlineList);
    };
  }, [socket, workspace]);

  return onlineList;
};

export default useOnlineList;
