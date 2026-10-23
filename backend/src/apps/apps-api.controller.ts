import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppCtx, AppTokenGuard } from './app-token.guard';
import { AppContext, AppsService } from './apps.service';
import {
  AppMessageRefDto,
  AppPostMessageDto,
  AppReactionDto,
  AppRespondDto,
  AppUpdateMessageDto,
} from './dto/apps.dto';

// 외부 앱이 부르는 API. Authorization: Bearer <봇 토큰>
@ApiTags('APPS API (봇 토큰)')
@ApiBearerAuth()
@Controller('api/apps')
export class AppsApiController {
  constructor(private appsService: AppsService) {}

  @ApiOperation({ summary: '토큰 확인 (어느 앱·워크스페이스인지)' })
  @UseGuards(AppTokenGuard)
  @Get('v1/auth.test')
  authTest(@AppCtx() ctx: AppContext) {
    return this.appsService.authTest(ctx);
  }

  @ApiOperation({ summary: '채널 목록 (공개 채널과 앱이 들어간 비공개 채널)' })
  @UseGuards(AppTokenGuard)
  @Get('v1/channels')
  channels(@AppCtx() ctx: AppContext) {
    return this.appsService.channels(ctx);
  }

  @ApiOperation({ summary: '워크스페이스 사람 목록' })
  @UseGuards(AppTokenGuard)
  @Get('v1/users')
  users(@AppCtx() ctx: AppContext) {
    return this.appsService.users(ctx);
  }

  @ApiOperation({
    summary: '메시지 보내기 (채널은 앱이 들어간 곳만, 또는 사람에게 DM)',
  })
  @UseGuards(AppTokenGuard)
  @Post('v1/chat.postMessage')
  post(@AppCtx() ctx: AppContext, @Body() body: AppPostMessageDto) {
    return this.appsService.postMessage(ctx, body);
  }

  @ApiOperation({ summary: '앱이 보낸 메시지 고치기' })
  @UseGuards(AppTokenGuard)
  @HttpCode(200)
  @Post('v1/chat.update')
  update(@AppCtx() ctx: AppContext, @Body() body: AppUpdateMessageDto) {
    return this.appsService.updateMessage(ctx, body);
  }

  @ApiOperation({ summary: '앱이 보낸 메시지 지우기' })
  @UseGuards(AppTokenGuard)
  @HttpCode(200)
  @Post('v1/chat.delete')
  remove(@AppCtx() ctx: AppContext, @Body() body: AppMessageRefDto) {
    return this.appsService.deleteMessage(ctx, body);
  }

  @ApiOperation({ summary: '채널 메시지에 리액션 달기' })
  @UseGuards(AppTokenGuard)
  @HttpCode(200)
  @Post('v1/reactions.add')
  react(@AppCtx() ctx: AppContext, @Body() body: AppReactionDto) {
    return this.appsService.addReaction(ctx, body);
  }

  @ApiOperation({
    summary:
      '슬래시 명령에 늦게 답하기 (명령 요청에 담긴 response_url, 30분·5번까지)',
  })
  @HttpCode(200)
  @Post('respond/:ticket')
  respond(@Param('ticket') ticket: string, @Body() body: AppRespondDto) {
    return this.appsService.respond(ticket, body);
  }
}
