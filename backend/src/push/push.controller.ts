import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoggedInGuard } from '../auth/logged-in.guard';
import { User } from '../common/decorators/user.decorator';
import { Users } from '../entities/Users';
import { PushSubscriptionDto, PushUnsubscribeDto } from './dto/push.dto';
import { PushService } from './push.service';

@ApiTags('PUSH')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/push')
export class PushController {
  constructor(private pushService: PushService) {}

  @ApiOperation({ summary: '푸시 구독에 쓸 공개 키' })
  @Get('key')
  key() {
    return this.pushService.getPublicKey();
  }

  @ApiOperation({ summary: '이 브라우저로 푸시 받기' })
  @Post('subscriptions')
  async subscribe(@User() user: Users, @Body() body: PushSubscriptionDto) {
    await this.pushService.subscribe(user.id, body);
    return 'ok';
  }

  @ApiOperation({ summary: '이 브라우저 푸시 끊기' })
  @Delete('subscriptions')
  async unsubscribe(@User() user: Users, @Body() body: PushUnsubscribeDto) {
    await this.pushService.unsubscribe(user.id, body.endpoint);
    return 'ok';
  }
}
