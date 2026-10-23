import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoggedInGuard } from '../auth/logged-in.guard';
import { User } from '../common/decorators/user.decorator';
import { Users } from '../entities/Users';
import { PinsService } from './pins.service';

@ApiTags('SIDEBAR PINS')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/workspaces/:url/sidebar-pins')
export class PinsController {
  constructor(private pinsService: PinsService) {}

  @ApiOperation({ summary: '사이드바에 고정한 채널·DM·스레드 (위에서부터)' })
  @Get()
  list(@Param('url') url: string, @User() user: Users) {
    return this.pinsService.list(url, user.id);
  }

  @ApiOperation({ summary: '고정 순서 바꾸기 (고정 id 배열)' })
  @Put('order')
  async reorder(
    @Param('url') url: string,
    @Body('ids') ids: number[],
    @User() user: Users,
  ) {
    await this.pinsService.reorder(url, ids, user.id);
    return 'ok';
  }

  @ApiOperation({
    summary:
      '고정하기 (kind: channel=채널 id, dm=상대 id, thread=스레드 첫 메시지 id)',
  })
  @Put(':kind/:id')
  async pin(
    @Param('url') url: string,
    @Param('kind') kind: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    await this.pinsService.pin(url, kind, id, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: '고정 풀기' })
  @Delete(':kind/:id')
  async unpin(
    @Param('url') url: string,
    @Param('kind') kind: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    await this.pinsService.unpin(url, kind, id, user.id);
    return 'ok';
  }
}
