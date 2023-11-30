import { Controller, Delete, Get, Post } from '@nestjs/common';

@Controller('api/workspaces/:url')
export class WorkspacesController {
  @Get()
  getMyWorkspaces() {}
  @Post()
  createWorkspace() {}

  @Get(':url/members')
  getAllMembersFromWorkspace() {}
  @Post(':url/members')
  inviteMembersToWorkspace() {}
  @Delete(':url/members/:id')
  kickMemberFromWorkspace() {}
  @Get(':url/members/:id')
  getMemberInfoInWorkspace() {}

  @Get(':url/users/:id')
  DEPRECATED_getMemberInfoInWorkspace() {
    this.getMemberInfoInWorkspace();
  }
}
