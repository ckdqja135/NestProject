import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoggedInGuard } from '../auth/logged-in.guard';
import { User } from '../common/decorators/user.decorator';
import { Users } from '../entities/Users';
import { TasksService } from './tasks.service';

@ApiTags('TASKS')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/workspaces/:url/tasks')
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @ApiOperation({ summary: '내 할 일 (데이터베이스 항목 중 내가 담당자인 것)' })
  @Get()
  listMine(@Param('url') url: string, @User() user: Users) {
    return this.tasksService.listMine(url, user.id);
  }
}
