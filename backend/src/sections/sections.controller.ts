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
import { CreateSectionDto, UpdateSectionDto } from './dto/section.dto';
import { SectionsService } from './sections.service';

@ApiTags('SIDEBAR SECTION')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/workspaces/:url/sidebar-sections')
export class SectionsController {
  constructor(private sectionsService: SectionsService) {}

  @ApiOperation({ summary: '내 사이드바 섹션 (넣은 채널·DM 포함)' })
  @Get()
  list(@Param('url') url: string, @User() user: Users) {
    return this.sectionsService.list(url, user.id);
  }

  @ApiOperation({ summary: '섹션 만들기' })
  @Post()
  create(
    @Param('url') url: string,
    @Body() body: CreateSectionDto,
    @User() user: Users,
  ) {
    return this.sectionsService.create(url, body.name, user.id);
  }

  @ApiOperation({ summary: '섹션 이름·순서 바꾸기' })
  @Patch(':id')
  async update(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateSectionDto,
    @User() user: Users,
  ) {
    await this.sectionsService.update(url, id, body, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: '섹션 지우기 (안의 채널·DM 은 원래 목록으로)' })
  @Delete(':id')
  async remove(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    await this.sectionsService.remove(url, id, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: '채널·DM 을 섹션으로 옮기기' })
  @Put(':id/items/:kind/:targetId')
  async putItem(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Param('kind') kind: string,
    @Param('targetId', ParseIntPipe) targetId: number,
    @User() user: Users,
  ) {
    await this.sectionsService.putItem(url, id, kind, targetId, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: '섹션에서 빼기' })
  @Delete('items/:kind/:targetId')
  async removeItem(
    @Param('url') url: string,
    @Param('kind') kind: string,
    @Param('targetId', ParseIntPipe) targetId: number,
    @User() user: Users,
  ) {
    await this.sectionsService.removeItem(url, kind, targetId, user.id);
    return 'ok';
  }
}
