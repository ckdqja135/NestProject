import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

// 프론트 빌드(front/dist) 가 있고 운영 모드면 같은 서버에서 프론트를 서빙한다.
// API(/api), 업로드(/uploads), 소켓(/socket.io) 이 아닌 GET 요청은 index.html 로 보내 SPA 라우팅이 동작하게 한다.
export function serveFrontend(app: NestExpressApplication) {
  const frontDir = path.resolve(
    process.env.FRONT_DIR || path.join(process.cwd(), 'front'),
  );
  const indexHtml = path.join(frontDir, 'index.html');
  const distDir = path.join(frontDir, 'dist');
  if (
    process.env.NODE_ENV !== 'production' ||
    !fs.existsSync(indexHtml) ||
    !fs.existsSync(distDir)
  ) {
    return;
  }
  app.useStaticAssets(distDir, { prefix: '/dist' });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      req.method !== 'GET' ||
      /^\/(api|uploads|dist|socket\.io)(\/|$)/.test(req.path)
    ) {
      return next();
    }
    res.sendFile(indexHtml);
  });
  new Logger('Frontend').log(`프론트 서빙: ${frontDir}`);
}
