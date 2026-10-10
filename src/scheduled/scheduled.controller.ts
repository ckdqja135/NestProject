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
import { CreateReminderDto, CreateScheduledDto } from './dto/scheduled.dto';
import { ScheduledService } from './scheduled.service';

@ApiTags('SCHEDULED')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/workspaces/:url')
export class ScheduledController {
  constructor(private scheduledService: ScheduledService) {}

  @ApiOperation({ summary: '내 예약 메시지 목록 (보낼 시각 순)' })
  @Get('scheduled')
  getScheduled(@Param('url') url: string, @User() user: Users) {
    return this.scheduledService.getScheduled(url, user.id);
  }

  @ApiOperation({ summary: '메시지 예약 (채널 또는 DM)' })
  @Post('scheduled')
  createScheduled(
    @Param('url') url: string,
    @Body() body: CreateScheduledDto,
    @User() user: Users,
  ) {
    return this.scheduledService.createScheduled(url, body, user.id);
  }

  @ApiOperation({ summary: '예약 취소' })
  @Delete('scheduled/:id')
  async cancelScheduled(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    await this.scheduledService.cancelScheduled(url, id, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: '내 리마인더 목록 (알릴 시각 순)' })
  @Get('reminders')
  getReminders(@Param('url') url: string, @User() user: Users) {
    return this.scheduledService.getReminders(url, user.id);
  }

  @ApiOperation({ summary: '메시지 리마인더 (정한 시각에 다시 알려줌)' })
  @Post('reminders')
  createReminder(
    @Param('url') url: string,
    @Body() body: CreateReminderDto,
    @User() user: Users,
  ) {
    return this.scheduledService.createReminder(url, body, user.id);
  }

  @ApiOperation({ summary: '리마인더 취소' })
  @Delete('reminders/:id')
  async cancelReminder(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    await this.scheduledService.cancelReminder(url, id, user.id);
    return 'ok';
  }
}
