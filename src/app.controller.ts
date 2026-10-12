import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';
import { LoggedInGuard } from './auth/logged-in.guard';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello() {
    return this.appService.getHello();
  }

  // 통화(WebRTC) 연결에 쓸 서버 목록. 같은 네트워크가 아니면 TURN 서버가 필요할 수 있다 (.env 의 TURN_URL 등)
  @ApiCookieAuth('connect.sid')
  @ApiOperation({ summary: '통화 연결 설정 (STUN/TURN 서버)' })
  @UseGuards(LoggedInGuard)
  @Get('api/rtc-config')
  getRtcConfig() {
    const iceServers: {
      urls: string;
      username?: string;
      credential?: string;
    }[] = [{ urls: process.env.STUN_URL || 'stun:stun.l.google.com:19302' }];
    if (process.env.TURN_URL) {
      iceServers.push({
        urls: process.env.TURN_URL,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL,
      });
    }
    return { iceServers };
  }
}
