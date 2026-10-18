import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoggedInGuard } from '../auth/logged-in.guard';
import { User } from '../common/decorators/user.decorator';
import { Users } from '../entities/Users';
import { ChannelsService } from './channels.service';

@ApiTags('CHANNEL')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/workspaces/:url/threads')
export class ThreadsController {
  constructor(private channelsService: ChannelsService) {}

  @ApiOperation({
    summary: '내가 참여한 스레드 (원본을 썼거나 답글을 단 것), 최근 답글 순',
  })
  @Get()
  getMyThreads(@Param('url') url: string, @User() user: Users) {
    return this.channelsService.getMyThreads(url, user.id);
  }
}
