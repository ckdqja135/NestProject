import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

// 브라우저에서 쿠키(로그인 세션)를 실어 요청할 수 있는 출처.
// CORS_ORIGIN(쉼표로 구분)이 없으면 개발 모드에서는 프론트 개발 서버만, 운영 모드에서는 같은 출처만 허용한다.
const allowedOrigins = () =>
  (
    process.env.CORS_ORIGIN ||
    (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3090')
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

export const isAllowedOrigin = (origin?: string, host?: string) => {
  if (!origin || allowedOrigins().includes(origin)) {
    return true;
  }
  // 같은 출처 (운영 모드에서 이 서버가 프론트도 서빙할 때)
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
};

// cors 패키지/socket.io 의 origin 옵션 형식
export const corsOrigin = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) => callback(null, isAllowedOrigin(origin));

// 1분당 요청 수 제한 (IP 기준). 테스트 등에서 env 로 바꿀 수 있다.
export const rateLimitPerMinute = () =>
  Number(process.env.RATE_LIMIT_PER_MINUTE) || 600;
// 로그인/회원가입/비밀번호 변경은 더 엄격하게 (비밀번호 대입 방지)
export const authRateLimitPerMinute = () =>
  Number(process.env.AUTH_RATE_LIMIT_PER_MINUTE) || 10;

export function applySecurity(app: NestExpressApplication) {
  // 프록시(nginx, 로드밸런서) 뒤에서는 실제 접속 IP 로 요청 수를 센다
  if (process.env.TRUST_PROXY) {
    app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
  }
  app.enableCors({ origin: corsOrigin, credentials: true });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          // emotion 이 런타임에 스타일을 넣고, 아이콘 등은 슬랙 CDN 의 CSS 를 쓴다
          styleSrc: ["'self'", "'unsafe-inline'", 'https://a.slack-edge.com'],
          fontSrc: ["'self'", 'data:', 'https://a.slack-edge.com'],
          // 프로필 그림(Gravatar), GIF(GIPHY), 기기에 저장한 파일 미리보기(blob:)
          imgSrc: [
            "'self'",
            'data:',
            'blob:',
            'https://*.gravatar.com',
            'https://*.giphy.com',
            'https://a.slack-edge.com',
          ],
          mediaSrc: ["'self'", 'blob:'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          // http 로 서비스하는 동안에는 요청을 https 로 바꾸지 않는다
          upgradeInsecureRequests:
            process.env.COOKIE_SECURE === 'true' ? [] : null,
        },
      },
      // 다른 출처의 이미지(Gravatar, GIPHY)를 그대로 쓰기 위해 끈다
      crossOriginEmbedderPolicy: false,
    }),
  );
}
