import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './httpException.filter';
import { ValidationPipe } from '@nestjs/common';
import passport from 'passport';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { SessionIoAdapter } from './events/session-io.adapter';
import { createSessionStore } from './session-store';
import { serveFrontend } from './serve-frontend';
import { applySecurity } from './security';

declare const module: any;

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // 보안 헤더(helmet, CSP), 허용한 출처만 CORS
  applySecurity(app);
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Shlack API')
    .setDescription('Shlack 개발을 위한 API 문서입니다.')
    .setVersion('1.0')
    .addCookieAuth('connect.sid')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  const sessionMiddleware = session({
    store: await createSessionStore(),
    resave: false,
    saveUninitialized: false,
    secret: process.env.SECRET,
    cookie: {
      httpOnly: true,
      // 다른 사이트에서 보낸 요청·웹소켓 연결에는 로그인 쿠키가 실리지 않게 한다
      sameSite: 'lax',
      // HTTPS 로 서비스할 때는 COOKIE_SECURE=true
      secure: process.env.COOKIE_SECURE === 'true',
    },
  });
  app.use(cookieParser());
  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());
  // 소켓 연결에도 같은 세션을 적용해 로그인한 사용자만 접속할 수 있게 한다
  app.useWebSocketAdapter(
    new SessionIoAdapter(app, [
      sessionMiddleware,
      passport.initialize(),
      passport.session(),
    ]),
  );

  // 운영 모드에서는 프론트 빌드 결과(front/dist)도 이 서버가 서빙한다
  serveFrontend(app);

  const port = process.env.PORT || 3002;
  await app.listen(port);
  console.log(`listening on port ${port}`);

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}
bootstrap();
