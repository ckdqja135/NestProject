import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';
import { LoggedInGuard } from '../auth/logged-in.guard';
import { User } from '../common/decorators/user.decorator';
import { Users } from '../entities/Users';
import { MentionsService } from './mentions.service';

class ReadMentionsDto {
  @IsOptional()
  @IsInt()
  channelId?: number;
}

@ApiTags('MENTION')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/workspaces/:url/mentions')
export class MentionsController {
  constructor(private mentionsService: MentionsService) {}

  @ApiOperation({ summary: '내가 받은 멘션 목록과 채널별 안 읽은 멘션 수' })
  @Get()
  getMentions(@Param('url') url: string, @User() user: Users) {
    return this.mentionsService.getMyMentions(url, user.id);
  }

  @ApiOperation({ summary: '멘션 읽음 처리 (channelId 가 있으면 그 채널만)' })
  @Post('read')
  markRead(
    @Param('url') url: string,
    @Body() body: ReadMentionsDto,
    @User() user: Users,
  ) {
    return this.mentionsService.markRead(url, user.id, body.channelId);
  }
}
