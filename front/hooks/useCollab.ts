import useSocket from '@hooks/useSocket';
import { IUser } from '@typings/db';
import CollabProvider, { colorFor } from '@utils/collab/CollabProvider';
import { useEffect, useReducer, useState } from 'react';

// 문서 하나의 실시간 동시 편집 연결 (화면을 떠나면 나간다)
export default function useCollab(workspace: string, docId: number | null, me?: IUser) {
  const [socket] = useSocket(workspace);
  const [provider, setProvider] = useState<CollabProvider | null>(null);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const meId = me?.id;
  const meName = me?.nickname;

  useEffect(() => {
    if (!socket || !docId || !meId) return undefined;
    const next = new CollabProvider(socket, docId, { id: meId, name: meName || '', color: colorFor(meId) });
    const unsubscribe = next.subscribe(rerender);
    setProvider(next);
    return () => {
      unsubscribe();
      next.destroy();
      setProvider(null);
    };
  }, [socket, docId, meId, meName]);

  return {
    provider,
    status: provider?.status ?? 'connecting',
    synced: !!provider?.synced,
    canEdit: !!provider?.canEdit,
  };
}
