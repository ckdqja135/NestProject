import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoggedInGuard } from '../auth/logged-in.guard';
import { User } from '../common/decorators/user.decorator';
import { Users } from '../entities/Users';
import { ChannelTabsService } from './channel-tabs.service';
import {
  AddChannelTabDto,
  ReorderChannelTabsDto,
  UpdateChannelTabDto,
} from './dto/channel-tabs.dto';

@ApiTags('CHANNEL TABS')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/workspaces/:url/channels/:name/tabs')
export class ChannelTabsController {
  constructor(private tabsService: ChannelTabsService) {}

  @ApiOperation({ summary: '채널 탭 목록 (채널 멤버)' })
  @Get()
  list(
    @Param('url') url: string,
    @Param('name') name: string,
    @User() user: Users,
  ) {
    return this.tabsService.list(url, name, user.id);
  }

  @ApiOperation({ summary: '탭 추가 (있는 문서 또는 새 문서)' })
  @Post()
  add(
    @Param('url') url: string,
    @Param('name') name: string,
    @Body() body: AddChannelTabDto,
    @User() user: Users,
  ) {
    return this.tabsService.add(url, name, body, user.id);
  }

  @ApiOperation({ summary: '탭 순서 바꾸기' })
  @Put('order')
  async reorder(
    @Param('url') url: string,
    @Param('name') name: string,
    @Body() body: ReorderChannelTabsDto,
    @User() user: Users,
  ) {
    await this.tabsService.reorder(url, name, body.ids, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: '채널 멤버에게 줄 권한 바꾸기 (문서 관리자)' })
  @Patch(':tabId')
  update(
    @Param('url') url: string,
    @Param('name') name: string,
    @Param('tabId', ParseIntPipe) tabId: number,
    @Body() body: UpdateChannelTabDto,
    @User() user: Users,
  ) {
    return this.tabsService.update(url, name, tabId, body, user.id);
  }

  @ApiOperation({ summary: '탭 빼기' })
  @Delete(':tabId')
  async remove(
    @Param('url') url: string,
    @Param('name') name: string,
    @Param('tabId', ParseIntPipe) tabId: number,
    @User() user: Users,
  ) {
    await this.tabsService.remove(url, name, tabId, user.id);
    return 'ok';
  }
}
