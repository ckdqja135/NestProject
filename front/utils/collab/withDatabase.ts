import { IUser } from '@typings/db';
import { Socket } from 'socket.io-client';
import CollabProvider, { colorFor } from './CollabProvider';

// 데이터베이스 문서에 잠깐 붙어서 일을 하고 나온다
const withDatabase = <T>(socket: Socket, docId: number, me: IUser, work: (provider: CollabProvider) => T): Promise<T> =>
  new Promise((resolve, reject) => {
    const provider = new CollabProvider(socket, docId, { id: me.id, name: me.nickname, color: colorFor(me.id) });
    const timer = window.setTimeout(() => finish(new Error('데이터베이스에 연결하지 못했어요.')), 10_000);
    let done = false;
    const finish = (error: Error | null, value?: T) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      unsubscribe();
      // 보낸 변경이 먼저 나가도록 조금 기다렸다가 나온다
      window.setTimeout(() => provider.destroy(), 300);
      if (error) reject(error);
      else resolve(value as T);
    };
    const unsubscribe = provider.subscribe(() => {
      if (provider.status === 'error') finish(new Error('이 데이터베이스를 열 수 없어요.'));
      if (!provider.synced || done) return;
      if (!provider.canEdit) {
        finish(new Error('이 데이터베이스를 고칠 권한이 없어요.'));
        return;
      }
      try {
        finish(null, work(provider));
      } catch (err) {
        finish(err as Error);
      }
    });
  });

export default withDatabase;
