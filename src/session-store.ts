import { Logger } from '@nestjs/common';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

const logger = new Logger('Session');

// REDIS_URL 이 있으면 Redis 에 세션을 저장한다 (서버를 재시작해도 로그인 유지, 여러 서버에서 공유).
// 없으면 express-session 기본 메모리 저장소를 쓴다 (로컬 개발용, 재시작하면 로그아웃).
export async function createSessionStore() {
  const url = process.env.REDIS_URL;
  if (!url) {
    logger.warn(
      'REDIS_URL 이 없어 세션을 메모리에 저장합니다. 서버를 재시작하면 모두 로그아웃됩니다.',
    );
    return undefined;
  }
  const client = createClient({ url });
  client.on('error', (error) =>
    logger.error(`Redis 연결 오류: ${error.message}`),
  );
  await client.connect();
  logger.log(`세션 저장소: Redis (${new URL(url).host})`);
  return new RedisStore({ client, prefix: 'shlack:sess:' });
}
