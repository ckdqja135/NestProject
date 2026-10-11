import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoggedInGuard } from '../auth/logged-in.guard';
import { User } from '../common/decorators/user.decorator';
import { Users } from '../entities/Users';
import { DraftDto, ReadMarkerDto } from './dto/sync.dto';
import { SyncService } from './sync.service';

@ApiTags('SYNC')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/workspaces/:url')
export class SyncController {
  constructor(private syncService: SyncService) {}

  @ApiOperation({ summary: '기기 간 동기화: 읽은 위치와 쓰다 만 메시지' })
  @Get('sync')
  getSync(@Param('url') url: string, @User() user: Users) {
    return this.syncService.getSync(url, user.id);
  }

  @ApiOperation({ summary: '어디까지 읽었는지 기록 (앞으로만 간다)' })
  @Put('read-markers')
  putReadMarker(
    @Param('url') url: string,
    @Body() body: ReadMarkerDto,
    @User() user: Users,
  ) {
    return this.syncService.putReadMarker(url, body.key, body.at, user.id);
  }

  @ApiOperation({ summary: '쓰다 만 메시지 저장 (빈 내용이면 삭제)' })
  @Put('drafts')
  putDraft(
    @Param('url') url: string,
    @Body() body: DraftDto,
    @User() user: Users,
  ) {
    return this.syncService.putDraft(
      url,
      body.key,
      body.content,
      body.at,
      user.id,
    );
  }
}
