import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoggedInGuard } from '../auth/logged-in.guard';
import { User } from '../common/decorators/user.decorator';
import { Users } from '../entities/Users';
import { AppsService } from './apps.service';
import {
  AppChannelDto,
  AppCommandDto,
  CreateAppDto,
  RunCommandDto,
  UpdateAppDto,
} from './dto/apps.dto';

@ApiTags('APPS')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/workspaces/:url/apps')
export class AppsController {
  constructor(private appsService: AppsService) {}

  @ApiOperation({ summary: '앱 목록 (관리자)' })
  @Get()
  list(@Param('url') url: string, @User() user: Users) {
    return this.appsService.list(url, user.id);
  }

  @ApiOperation({
    summary: '앱 만들기 (관리자). 봇 토큰은 이 응답에서 한 번만 보여 준다',
  })
  @Post()
  create(
    @Param('url') url: string,
    @Body() body: CreateAppDto,
    @User() user: Users,
  ) {
    return this.appsService.create(url, body, user.id);
  }

  @ApiOperation({ summary: '이 워크스페이스에서 쓸 수 있는 앱 명령 (멤버)' })
  @Get('commands')
  commands(@Param('url') url: string, @User() user: Users) {
    return this.appsService.listCommands(url, user.id);
  }

  @ApiOperation({ summary: '앱 명령 실행 (/명령 을 입력했을 때)' })
  @Post('commands/run')
  run(
    @Param('url') url: string,
    @Body() body: RunCommandDto,
    @User() user: Users,
  ) {
    return this.appsService.runCommand(url, body, user.id);
  }

  @ApiOperation({
    summary: '이름·설명·이벤트 주소·받을 이벤트 바꾸기 (관리자)',
  })
  @Patch(':id')
  update(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAppDto,
    @User() user: Users,
  ) {
    return this.appsService.update(url, id, body, user.id);
  }

  @ApiOperation({ summary: '앱 지우기 (관리자)' })
  @Delete(':id')
  async remove(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    await this.appsService.remove(url, id, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: '봇 토큰 다시 만들기 (예전 토큰은 바로 못 쓴다)' })
  @Post(':id/token')
  regenerate(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    return this.appsService.regenerateToken(url, id, user.id);
  }

  @ApiOperation({ summary: '서명 비밀값 보기 (관리자)' })
  @Get(':id/secret')
  secret(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    return this.appsService.revealSecret(url, id, user.id);
  }

  @ApiOperation({ summary: '앱을 채널에 넣기' })
  @Post(':id/channels')
  addChannel(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AppChannelDto,
    @User() user: Users,
  ) {
    return this.appsService.addToChannel(url, id, body.channel, user.id);
  }

  @ApiOperation({ summary: '앱을 채널에서 빼기' })
  @Delete(':id/channels/:channel')
  removeChannel(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Param('channel') channel: string,
    @User() user: Users,
  ) {
    return this.appsService.removeFromChannel(url, id, channel, user.id);
  }

  @ApiOperation({ summary: '슬래시 명령 등록' })
  @Post(':id/commands')
  addCommand(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AppCommandDto,
    @User() user: Users,
  ) {
    return this.appsService.addCommand(url, id, body, user.id);
  }

  @ApiOperation({ summary: '슬래시 명령 지우기' })
  @Delete(':id/commands/:commandId')
  removeCommand(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Param('commandId', ParseIntPipe) commandId: number,
    @User() user: Users,
  ) {
    return this.appsService.removeCommand(url, id, commandId, user.id);
  }
}
