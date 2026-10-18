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
import { InviteMemberDto } from '../common/dto/invite-member.dto';
import { Users } from '../entities/Users';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import {
  TransferOwnerDto,
  UpdateWorkspaceDto,
} from './dto/update-workspace.dto';
import { WorkspacesService } from './workspaces.service';

@ApiTags('WORKSPACE')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/workspaces')
export class WorkspacesController {
  constructor(private workspacesService: WorkspacesService) {}

  @ApiOperation({ summary: '내 워크스페이스 목록' })
  @Get()
  getMyWorkspaces(@User() user: Users) {
    return this.workspacesService.findMyWorkspaces(user.id);
  }

  @ApiOperation({ summary: '워크스페이스 생성' })
  @Post()
  createWorkspace(@User() user: Users, @Body() body: CreateWorkspaceDto) {
    return this.workspacesService.createWorkspace(
      body.workspace,
      body.url,
      user.id,
    );
  }

  @ApiOperation({ summary: '워크스페이스 멤버 목록' })
  @Get(':url/members')
  getAllMembersFromWorkspace(@Param('url') url: string, @User() user: Users) {
    return this.workspacesService.getWorkspaceMembers(url, user.id);
  }

  @ApiOperation({ summary: '워크스페이스 멤버 초대' })
  @Post(':url/members')
  async inviteMembersToWorkspace(
    @Param('url') url: string,
    @Body() body: InviteMemberDto,
    @User() user: Users,
  ) {
    await this.workspacesService.inviteMember(url, body.email, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: '워크스페이스 멤버 강퇴/탈퇴' })
  @Delete(':url/members/:id')
  async kickMemberFromWorkspace(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    await this.workspacesService.kickMember(url, id, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: '워크스페이스 특정 멤버 정보' })
  @Get(':url/members/:id')
  getMemberInfoInWorkspace(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    return this.workspacesService.getWorkspaceMember(url, id, user.id);
  }

  @ApiOperation({ summary: '워크스페이스 특정 멤버 정보 (DEPRECATED)' })
  @Get(':url/users/:id')
  DEPRECATED_getMemberInfoInWorkspace(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    return this.workspacesService.getWorkspaceMember(url, id, user.id);
  }

  @ApiOperation({ summary: '워크스페이스 이름/url 변경 (소유자만)' })
  @Patch(':url')
  updateWorkspace(
    @Param('url') url: string,
    @Body() body: UpdateWorkspaceDto,
    @User() user: Users,
  ) {
    return this.workspacesService.updateWorkspace(url, body, user.id);
  }

  @ApiOperation({ summary: '워크스페이스 소유권 넘기기 (소유자만)' })
  @Put(':url/owner')
  transferOwnership(
    @Param('url') url: string,
    @Body() body: TransferOwnerDto,
    @User() user: Users,
  ) {
    return this.workspacesService.transferOwnership(url, body.userId, user.id);
  }
}
