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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoggedInGuard } from '../auth/logged-in.guard';
import { User } from '../common/decorators/user.decorator';
import { Users } from '../entities/Users';
import { CalendarService } from './calendar.service';
import {
  CreateEventDto,
  EventListQuery,
  RsvpDto,
  UpdateEventDto,
} from './dto/calendar.dto';

@ApiTags('CALENDAR')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/workspaces/:url/calendar')
export class CalendarController {
  constructor(private calendarService: CalendarService) {}

  @ApiOperation({ summary: '기간 안의 일정 (내 것 + users 로 고른 동료 것)' })
  @Get('events')
  listEvents(
    @Param('url') url: string,
    @Query() query: EventListQuery,
    @User() user: Users,
  ) {
    return this.calendarService.listEvents(url, user.id, query);
  }

  @ApiOperation({ summary: '일정 하나' })
  @Get('events/:id')
  getEvent(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    return this.calendarService.getEvent(url, id, user.id);
  }

  @ApiOperation({ summary: '일정 만들기 (참석자에게 봇이 초대 알림)' })
  @Post('events')
  createEvent(
    @Param('url') url: string,
    @Body() body: CreateEventDto,
    @User() user: Users,
  ) {
    return this.calendarService.createEvent(url, body, user.id);
  }

  @ApiOperation({ summary: '일정 고치기 (주최자만, 참석자에게 변경 알림)' })
  @Patch('events/:id')
  updateEvent(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateEventDto,
    @User() user: Users,
  ) {
    return this.calendarService.updateEvent(url, id, body, user.id);
  }

  @ApiOperation({ summary: '일정 지우기 (주최자만, 참석자에게 취소 알림)' })
  @Delete('events/:id')
  deleteEvent(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    return this.calendarService.deleteEvent(url, id, user.id);
  }

  @ApiOperation({ summary: '참석 응답 (수락·거절, 주최자에게 알림)' })
  @Put('events/:id/rsvp')
  rsvp(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RsvpDto,
    @User() user: Users,
  ) {
    return this.calendarService.rsvp(url, id, body.status, user.id);
  }

  @ApiOperation({ summary: '구독한 동료 캘린더' })
  @Get('follows')
  getFollows(@Param('url') url: string, @User() user: Users) {
    return this.calendarService.getFollows(url, user.id);
  }

  @ApiOperation({ summary: '동료 캘린더 구독' })
  @Put('follows/:userId')
  follow(
    @Param('url') url: string,
    @Param('userId', ParseIntPipe) userId: number,
    @User() user: Users,
  ) {
    return this.calendarService.follow(url, userId, user.id);
  }

  @ApiOperation({ summary: '동료 캘린더 구독 끊기' })
  @Delete('follows/:userId')
  unfollow(
    @Param('url') url: string,
    @Param('userId', ParseIntPipe) userId: number,
    @User() user: Users,
  ) {
    return this.calendarService.unfollow(url, userId, user.id);
  }

  @ApiOperation({ summary: '캘린더 어시스턴트 봇 계정 id' })
  @Get('bot')
  getBot(@Param('url') url: string, @User() user: Users) {
    return this.calendarService.getBot(url, user.id);
  }
}
