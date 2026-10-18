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
import { CreateGroupDto, UpdateGroupDto } from './dto/group.dto';
import { GroupsService } from './groups.service';

@ApiTags('GROUP')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/workspaces/:url/groups')
export class GroupsController {
  constructor(private groupsService: GroupsService) {}

  @ApiOperation({ summary: '사용자 그룹 목록 (멤버 포함)' })
  @Get()
  getGroups(@Param('url') url: string, @User() user: Users) {
    return this.groupsService.getGroups(url, user.id);
  }

  @ApiOperation({ summary: '사용자 그룹 만들기 (멤버를 안 정하면 나만)' })
  @Post()
  createGroup(
    @Param('url') url: string,
    @Body() body: CreateGroupDto,
    @User() user: Users,
  ) {
    return this.groupsService.createGroup(url, body, user.id);
  }

  @ApiOperation({
    summary: '그룹 이름·설명·멤버 변경 (만든 사람·워크스페이스 소유자)',
  })
  @Patch(':id')
  updateGroup(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateGroupDto,
    @User() user: Users,
  ) {
    return this.groupsService.updateGroup(url, id, body, user.id);
  }

  @ApiOperation({ summary: '그룹 삭제 (만든 사람·워크스페이스 소유자)' })
  @Delete(':id')
  async deleteGroup(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    await this.groupsService.deleteGroup(url, id, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: '그룹 참여' })
  @Post(':id/members/me')
  async join(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    await this.groupsService.setMyMembership(url, id, true, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: '그룹 나가기' })
  @Delete(':id/members/me')
  async leave(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    await this.groupsService.setMyMembership(url, id, false, user.id);
    return 'ok';
  }
}
