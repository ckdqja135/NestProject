import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { RequestHandler } from 'express';
import { ServerOptions, Server } from 'socket.io';

// 핸드셰이크 요청에만 미들웨어 적용 (이후 HTTP long-polling 요청은 같은 세션이므로 생략)
const onlyForHandshake =
  (middleware: RequestHandler) => (req, res, next: (err?: unknown) => void) => {
    const isHandshake = req._query?.sid === undefined;
    if (isHandshake) {
      middleware(req, res, next);
    } else {
      next();
    }
  };

// HTTP 와 같은 세션/패스포트 미들웨어를 소켓 연결에도 적용해서
// 클라이언트가 보낸 id 가 아니라 로그인 세션으로 사용자를 식별한다.
export class SessionIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly middlewares: RequestHandler[],
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server: Server = super.createIOServer(port, options);
    this.middlewares.forEach((middleware) =>
      server.engine.use(onlyForHandshake(middleware)),
    );
    // 로그인하지 않은 연결은 거부
    server.engine.use(
      onlyForHandshake((req, res, next) => {
        if ((req as any).user) {
          next();
        } else {
          res.writeHead(401);
          res.end();
        }
      }),
    );
    return server;
  }
}
