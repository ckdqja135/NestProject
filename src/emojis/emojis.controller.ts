import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoggedInGuard } from '../auth/logged-in.guard';
import { User } from '../common/decorators/user.decorator';
import { Users } from '../entities/Users';
import { CreateEmojiDto } from './dto/emoji.dto';
import { EmojisService } from './emojis.service';

@ApiTags('EMOJI')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/workspaces/:url/emojis')
export class EmojisController {
  constructor(private emojisService: EmojisService) {}

  @ApiOperation({ summary: '커스텀 이모지 목록' })
  @Get()
  getEmojis(@Param('url') url: string, @User() user: Users) {
    return this.emojisService.getEmojis(url, user.id);
  }

  @ApiOperation({ summary: '커스텀 이모지 올리기 (워크스페이스 멤버)' })
  @Post()
  createEmoji(
    @Param('url') url: string,
    @Body() body: CreateEmojiDto,
    @User() user: Users,
  ) {
    return this.emojisService.createEmoji(url, body.name, body.image, user.id);
  }

  @ApiOperation({
    summary: '커스텀 이모지 삭제 (올린 사람·워크스페이스 소유자)',
  })
  @Delete(':id')
  async deleteEmoji(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    await this.emojisService.deleteEmoji(url, id, user.id);
    return 'ok';
  }
}
