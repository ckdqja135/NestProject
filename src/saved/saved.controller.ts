import {
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
import { SavedService } from './saved.service';

@ApiTags('SAVED')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/workspaces/:url/saved')
export class SavedController {
  constructor(private savedService: SavedService) {}

  @ApiOperation({ summary: '저장한 메시지 목록 (최신순)' })
  @Get()
  getSaved(@Param('url') url: string, @User() user: Users) {
    return this.savedService.getSaved(url, user.id);
  }

  @ApiOperation({ summary: '채널 메시지 저장' })
  @Put('chats/:chatId')
  async saveChat(
    @Param('url') url: string,
    @Param('chatId', ParseIntPipe) chatId: number,
    @User() user: Users,
  ) {
    await this.savedService.save(url, { chatId }, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: '채널 메시지 저장 취소' })
  @Delete('chats/:chatId')
  async unsaveChat(
    @Param('url') url: string,
    @Param('chatId', ParseIntPipe) chatId: number,
    @User() user: Users,
  ) {
    await this.savedService.remove(url, { chatId }, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: 'DM 저장' })
  @Put('dms/:dmId')
  async saveDM(
    @Param('url') url: string,
    @Param('dmId', ParseIntPipe) dmId: number,
    @User() user: Users,
  ) {
    await this.savedService.save(url, { dmId }, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: 'DM 저장 취소' })
  @Delete('dms/:dmId')
  async unsaveDM(
    @Param('url') url: string,
    @Param('dmId', ParseIntPipe) dmId: number,
    @User() user: Users,
  ) {
    await this.savedService.remove(url, { dmId }, user.id);
    return 'ok';
  }
}
