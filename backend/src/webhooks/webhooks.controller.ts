import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LoggedInGuard } from '../auth/logged-in.guard';
import { User } from '../common/decorators/user.decorator';
import { Users } from '../entities/Users';
import { CreateWebhookDto, IncomingWebhookDto } from './dto/webhook.dto';
import { WebhooksService } from './webhooks.service';

@ApiTags('WEBHOOK')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/workspaces/:url/channels/:name/webhooks')
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @ApiOperation({ summary: '채널의 수신 웹훅 목록 (채널 멤버)' })
  @Get()
  getWebhooks(
    @Param('url') url: string,
    @Param('name') name: string,
    @User() user: Users,
  ) {
    return this.webhooksService.getWebhooks(url, name, user.id);
  }

  @ApiOperation({ summary: '수신 웹훅 만들기 (채널 멤버)' })
  @Post()
  createWebhook(
    @Param('url') url: string,
    @Param('name') name: string,
    @Body() body: CreateWebhookDto,
    @User() user: Users,
  ) {
    return this.webhooksService.createWebhook(url, name, body.name, user.id);
  }

  @ApiOperation({ summary: '수신 웹훅 삭제 (만든 사람·워크스페이스 소유자)' })
  @Delete(':id')
  async deleteWebhook(
    @Param('url') url: string,
    @Param('name') name: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    await this.webhooksService.deleteWebhook(url, name, id, user.id);
    return 'ok';
  }
}

// 외부 서비스가 부르는 주소 (로그인 없이 토큰으로)
@ApiTags('WEBHOOK')
@Controller('api/hooks')
export class IncomingWebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @ApiOperation({
    summary: '수신 웹훅으로 채널에 메시지 보내기 ({ "text": "..." })',
  })
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post(':token')
  @HttpCode(200)
  receive(@Param('token') token: string, @Body() body: IncomingWebhookDto) {
    return this.webhooksService.receive(token, body.text, body.username);
  }
}
