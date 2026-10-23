import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AppContext, AppsService } from './apps.service';

// 앱 API: Authorization: Bearer <봇 토큰> 으로 어느 앱인지 알아낸다 (로그인 세션은 쓰지 않는다)
@Injectable()
export class AppTokenGuard implements CanActivate {
  constructor(private appsService: AppsService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const header: string = request.headers?.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const app = await this.appsService.authenticate(token);
    if (!app) {
      throw new UnauthorizedException('앱 토큰이 올바르지 않습니다.');
    }
    request.appContext = app;
    return true;
  }
}

export const AppCtx = createParamDecorator(
  (_: unknown, context: ExecutionContext): AppContext =>
    context.switchToHttp().getRequest().appContext,
);
