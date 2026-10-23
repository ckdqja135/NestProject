import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, Not, Repository } from 'typeorm';
import { BotsService } from '../bots/bots.service';
import { DmsService } from '../dms/dms.service';
import { CalendarAttendees } from '../entities/CalendarAttendees';
import { CalendarEvents } from '../entities/CalendarEvents';
import { CalendarFollows } from '../entities/CalendarFollows';
import { Users } from '../entities/Users';
import { Workspaces } from '../entities/Workspaces';
import { EventsGateway } from '../events/events.gateway';
import { MailService } from '../mail/mail.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { CreateEventDto, MAX_REMINDER_MINUTES } from './dto/calendar.dto';

const TICK_MS = 15_000;
// 이미 시작한 지 5분이 넘은 일정은 뒤늦게 알리지 않는다
const LATE_MS = 5 * 60_000;
const MAX_RANGE_MS = 100 * 24 * 60 * 60_000;
const MAX_EVENT_MS = 366 * 24 * 60 * 60_000;
// 봇 메시지의 시각 표시 시간대 (사용자마다 다른 시간대는 화면에서 다시 계산한다)
const APP_TZ = process.env.APP_TZ || 'Asia/Seoul';

const appUrl = () =>
  (process.env.APP_URL || 'http://localhost:3090').replace(/\/$/, '');

// 일정 시각을 한국어로: '10월 20일 (월) 14:00 ~ 15:00', 종일이면 '10월 20일 (월) 종일'
export function formatWhen(
  startAt: Date,
  endAt: Date,
  allDay: boolean,
  timeZone = APP_TZ,
) {
  const date = new Intl.DateTimeFormat('ko-KR', {
    timeZone,
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
  const time = new Intl.DateTimeFormat('ko-KR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const dayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  if (allDay) {
    // 끝은 포함하지 않으므로 마지막 날은 끝에서 1ms 전
    const last = new Date(endAt.getTime() - 1);
    return dayKey.format(startAt) === dayKey.format(last)
      ? `${date.format(startAt)} 종일`
      : `${date.format(startAt)} ~ ${date.format(last)}`;
  }
  const sameDay = dayKey.format(startAt) === dayKey.format(endAt);
  return `${date.format(startAt)} ${time.format(startAt)} ~ ${
    sameDay ? '' : `${date.format(endAt)} `
  }${time.format(endAt)}`;
}

export function reminderLabel(minutes: number) {
  if (minutes <= 0) {
    return '지금';
  }
  if (minutes % 1440 === 0) {
    return `${minutes / 1440}일 전`;
  }
  if (minutes % 60 === 0) {
    return `${minutes / 60}시간 전`;
  }
  return `${minutes}분 전`;
}

type EventDto = Partial<CreateEventDto>;

@Injectable()
export class CalendarService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('CalendarService');
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @InjectRepository(CalendarEvents)
    private eventsRepository: Repository<CalendarEvents>,
    @InjectRepository(CalendarAttendees)
    private attendeesRepository: Repository<CalendarAttendees>,
    @InjectRepository(CalendarFollows)
    private followsRepository: Repository<CalendarFollows>,
    @InjectRepository(Users)
    private usersRepository: Repository<Users>,
    private workspacesService: WorkspacesService,
    private dmsService: DmsService,
    private botsService: BotsService,
    private eventsGateway: EventsGateway,
    private mailService: MailService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref?.();
    // 일정 허들: 일정을 볼 수 있는 사람이 들어가고, 시작되면 주최자·참석자(불참 빼고)에게 알린다
    this.eventsGateway.setScopeResolver('ev', async (url, id, userId) => {
      const { event } = await this.load(url, id, userId);
      return {
        ok: true,
        label: event.title,
        notify: [
          event.OwnerId,
          ...(event.Attendees || [])
            .filter((a) => a.status !== 'declined')
            .map((a) => a.UserId),
        ].filter((uid): uid is number => !!uid),
      };
    });
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async findWorkspace(url: string, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertMember(workspace.id, myId);
    return workspace;
  }

  private parseDate(value: string | undefined, name: string) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${name} 시각이 올바르지 않습니다.`);
    }
    return date;
  }

  private checkTimes(startAt: Date, endAt: Date) {
    if (endAt.getTime() <= startAt.getTime()) {
      throw new BadRequestException(
        '끝나는 시각은 시작 시각보다 뒤여야 합니다.',
      );
    }
    if (endAt.getTime() - startAt.getTime() > MAX_EVENT_MS) {
      throw new BadRequestException('일정은 1년을 넘을 수 없습니다.');
    }
  }

  private involved(event: CalendarEvents, userId: number) {
    return (
      event.OwnerId === userId ||
      (event.Attendees || []).some((a) => a.UserId === userId)
    );
  }

  // 화면에 줄 모양. 비공개 일정은 참석자가 아니면 '바쁨' 으로만
  private present(
    event: CalendarEvents,
    myId: number,
    calendars: number[] = [],
  ) {
    if (event.visibility === 'private' && !this.involved(event, myId)) {
      return {
        id: event.id,
        title: '바쁨',
        startAt: event.startAt,
        endAt: event.endAt,
        allDay: event.allDay,
        visibility: event.visibility,
        color: null,
        OwnerId: event.OwnerId,
        Attendees: [],
        masked: true,
        calendars,
        myStatus: null,
      };
    }
    const me = (event.Attendees || []).find((a) => a.UserId === myId);
    return {
      ...event,
      // 워크스페이스 정보는 응답에 넣지 않는다
      Workspace: undefined,
      masked: false,
      calendars,
      myStatus: event.OwnerId === myId ? 'owner' : me?.status || null,
    };
  }

  private changed(url: string, id: number) {
    this.eventsGateway.emitToWorkspace(url, 'calendarChanged', { id });
  }

  private eventLink(url: string, id: number) {
    return `${appUrl()}/workspace/${url}/calendar?event=${id}`;
  }

  private inviteText(event: CalendarEvents, url: string) {
    const owner = event.Owner?.nickname || '누군가';
    return [
      `📅 **${owner}** 님이 **${event.title}** 일정에 초대했습니다.`,
      `🕒 ${formatWhen(event.startAt, event.endAt, event.allDay)}`,
      event.location ? `📍 ${event.location}` : '',
      `참석 여부 알리기: ${this.eventLink(url, event.id)}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private changeText(event: CalendarEvents, url: string) {
    return [
      `✏️ **${event.title}** 일정이 바뀌었습니다.`,
      `🕒 ${formatWhen(event.startAt, event.endAt, event.allDay)}`,
      event.location ? `📍 ${event.location}` : '',
      `일정 보기: ${this.eventLink(url, event.id)}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private reminderText(event: CalendarEvents, url: string) {
    const minutes = event.reminderMinutes || 0;
    return [
      minutes > 0
        ? `⏰ **${event.title}** 이(가) ${reminderLabel(minutes).replace(
            ' 전',
            '',
          )} 뒤에 시작합니다.`
        : `⏰ **${event.title}** 이(가) 지금 시작합니다.`,
      `🕒 ${formatWhen(event.startAt, event.endAt, event.allDay)}`,
      event.location ? `📍 ${event.location}` : '',
      `일정 보기: ${this.eventLink(url, event.id)}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  // 봇이 DM 으로 알리고, 접속해 있지 않으면 (메일 설정이 있을 때) 이메일로도 알린다
  private async notify(
    workspace: Workspaces,
    userIds: number[],
    text: string,
    subject: string,
  ) {
    const botId = await this.botsService.ensureMember(workspace.id);
    for (const userId of new Set(userIds)) {
      if (userId === botId) {
        continue;
      }
      try {
        await this.dmsService.createWorkspaceDMChats(
          workspace.url,
          text,
          userId,
          botId,
        );
      } catch (error) {
        this.logger.warn(`봇 DM 을 보내지 못했습니다: ${error.message}`);
        continue;
      }
      if (
        !this.eventsGateway.isOnline(workspace.url, userId) &&
        this.mailService.isEnabled()
      ) {
        const user = await this.usersRepository.findOne({
          where: { id: userId },
        });
        if (user) {
          await this.mailService.send({
            to: user.email,
            subject,
            text: `${text.replace(/\*\*/g, '')}\n`,
          });
        }
      }
    }
  }

  // 참석자 검사: 나를 빼고, 워크스페이스 멤버만, 봇은 안 됨
  private async validateAttendees(
    workspaceId: number,
    ids: number[],
    myId: number,
  ) {
    const unique = [...new Set(ids)].filter((id) => id !== myId);
    if (!unique.length) {
      return [];
    }
    for (const id of unique) {
      await this.workspacesService.assertMember(workspaceId, id);
    }
    const users = await this.usersRepository.find({
      where: { id: In(unique) },
      select: ['id', 'bot'],
    });
    if (users.length !== unique.length) {
      throw new NotFoundException('존재하지 않는 사용자가 있습니다.');
    }
    if (users.some((u) => u.bot)) {
      throw new BadRequestException('봇은 참석자로 넣을 수 없습니다.');
    }
    return unique;
  }

  private async load(url: string, id: number, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    const event = await this.eventsRepository.findOne({
      where: { id, WorkspaceId: workspace.id },
      relations: ['Attendees', 'Attendees.User', 'Owner'],
    });
    if (
      !event ||
      (event.visibility === 'private' && !this.involved(event, myId))
    ) {
      throw new NotFoundException('존재하지 않는 일정입니다.');
    }
    return { workspace, event };
  }

  async listEvents(
    url: string,
    myId: number,
    query: { from: string; to: string; users?: string },
  ) {
    const workspace = await this.findWorkspace(url, myId);
    const from = this.parseDate(query.from, '시작');
    const to = this.parseDate(query.to, '끝');
    if (
      to.getTime() <= from.getTime() ||
      to.getTime() - from.getTime() > MAX_RANGE_MS
    ) {
      throw new BadRequestException('조회 기간이 올바르지 않습니다.');
    }
    const users = [
      ...new Set(
        (query.users || '')
          .split(',')
          .map((v) => Number(v))
          .filter((v) => Number.isInteger(v) && v > 0),
      ),
    ];
    if (!users.length) {
      users.push(myId);
    }
    for (const id of users) {
      if (id !== myId) {
        await this.workspacesService.assertMember(workspace.id, id);
      }
    }
    const events = await this.eventsRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.Attendees', 'a')
      .leftJoinAndSelect('a.User', 'au')
      .leftJoinAndSelect('e.Owner', 'o')
      .where('e.WorkspaceId = :workspaceId', { workspaceId: workspace.id })
      .andWhere('e.startAt < :to AND e.endAt > :from', { from, to })
      .andWhere(
        '(e.OwnerId IN (:...users) OR EXISTS (SELECT 1 FROM calendarattendees ca WHERE ca.EventId = e.id AND ca.UserId IN (:...users)))',
        { users },
      )
      .orderBy('e.startAt', 'ASC')
      .addOrderBy('e.id', 'ASC')
      .getMany();
    return events.map((event) =>
      this.present(
        event,
        myId,
        users.filter(
          (u) =>
            event.OwnerId === u ||
            (event.Attendees || []).some((a) => a.UserId === u),
        ),
      ),
    );
  }

  async getEvent(url: string, id: number, myId: number) {
    const { event } = await this.load(url, id, myId);
    return this.present(event, myId);
  }

  async createEvent(url: string, dto: CreateEventDto, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    const startAt = this.parseDate(dto.startAt, '시작');
    const endAt = this.parseDate(dto.endAt, '끝');
    this.checkTimes(startAt, endAt);
    const attendeeIds = await this.validateAttendees(
      workspace.id,
      dto.attendeeIds || [],
      myId,
    );
    const event = await this.eventsRepository.save({
      WorkspaceId: workspace.id,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      location: dto.location?.trim() || null,
      startAt,
      endAt,
      allDay: !!dto.allDay,
      color: dto.color || null,
      visibility: dto.visibility || 'public',
      reminderMinutes: dto.reminderMinutes ?? null,
      OwnerId: myId,
    });
    await this.attendeesRepository.save([
      { EventId: event.id, UserId: myId, status: 'accepted' as const },
      ...attendeeIds.map((UserId) => ({
        EventId: event.id,
        UserId,
        status: 'pending' as const,
      })),
    ]);
    const { event: full } = await this.load(url, event.id, myId);
    if (attendeeIds.length) {
      await this.notify(
        workspace,
        attendeeIds,
        this.inviteText(full, url),
        `[슐랙] 일정 초대: ${full.title}`,
      );
    }
    this.changed(url, event.id);
    return this.present(full, myId);
  }

  async updateEvent(url: string, id: number, dto: EventDto, myId: number) {
    const { workspace, event } = await this.load(url, id, myId);
    if (event.OwnerId !== myId) {
      throw new ForbiddenException('일정을 만든 사람만 고칠 수 있습니다.');
    }
    const startAt =
      dto.startAt !== undefined
        ? this.parseDate(dto.startAt, '시작')
        : event.startAt;
    const endAt =
      dto.endAt !== undefined ? this.parseDate(dto.endAt, '끝') : event.endAt;
    this.checkTimes(startAt, endAt);
    const update: Partial<CalendarEvents> = {};
    if (dto.title !== undefined) {
      update.title = dto.title.trim() || event.title;
    }
    if (dto.description !== undefined) {
      update.description = dto.description.trim() || null;
    }
    if (dto.location !== undefined) {
      update.location = dto.location.trim() || null;
    }
    if (dto.allDay !== undefined) {
      update.allDay = dto.allDay;
    }
    if (dto.color !== undefined) {
      update.color = dto.color || null;
    }
    if (dto.visibility !== undefined) {
      update.visibility = dto.visibility;
    }
    if (startAt.getTime() !== event.startAt.getTime()) {
      update.startAt = startAt;
      // 시각이 바뀌면 알림도 새 시각에 맞춰 다시 보낸다
      update.remindedAt = null;
    }
    if (endAt.getTime() !== event.endAt.getTime()) {
      update.endAt = endAt;
    }
    if (
      dto.reminderMinutes !== undefined &&
      dto.reminderMinutes !== event.reminderMinutes
    ) {
      update.reminderMinutes = dto.reminderMinutes;
      update.remindedAt = null;
    }
    if (Object.keys(update).length) {
      await this.eventsRepository.update(event.id, update);
    }
    let added: number[] = [];
    let removed: number[] = [];
    if (dto.attendeeIds !== undefined) {
      const wanted = await this.validateAttendees(
        workspace.id,
        dto.attendeeIds,
        myId,
      );
      const current = (event.Attendees || [])
        .map((a) => a.UserId)
        .filter((u) => u !== myId);
      added = wanted.filter((u) => !current.includes(u));
      removed = current.filter((u) => !wanted.includes(u));
      if (removed.length) {
        await this.attendeesRepository.delete({
          EventId: event.id,
          UserId: In(removed),
        });
      }
      if (added.length) {
        await this.attendeesRepository.save(
          added.map((UserId) => ({
            EventId: event.id,
            UserId,
            status: 'pending' as const,
          })),
        );
      }
    }
    const { event: fresh } = await this.load(url, event.id, myId);
    const coreChanged =
      (update.title !== undefined && update.title !== event.title) ||
      (update.location !== undefined && update.location !== event.location) ||
      (update.allDay !== undefined && update.allDay !== event.allDay) ||
      update.startAt !== undefined ||
      update.endAt !== undefined;
    const kept = (fresh.Attendees || [])
      .map((a) => a.UserId)
      .filter((u) => u !== myId && !added.includes(u));
    if (added.length) {
      await this.notify(
        workspace,
        added,
        this.inviteText(fresh, url),
        `[슐랙] 일정 초대: ${fresh.title}`,
      );
    }
    if (removed.length) {
      await this.notify(
        workspace,
        removed,
        `🚫 **${fresh.title}** 일정의 초대가 취소되었습니다.`,
        `[슐랙] 일정 초대 취소: ${fresh.title}`,
      );
    }
    if (coreChanged && kept.length) {
      await this.notify(
        workspace,
        kept,
        this.changeText(fresh, url),
        `[슐랙] 일정 변경: ${fresh.title}`,
      );
    }
    this.changed(url, event.id);
    return this.present(fresh, myId);
  }

  async deleteEvent(url: string, id: number, myId: number) {
    const { workspace, event } = await this.load(url, id, myId);
    if (event.OwnerId !== myId) {
      throw new ForbiddenException('일정을 만든 사람만 지울 수 있습니다.');
    }
    const others = (event.Attendees || [])
      .map((a) => a.UserId)
      .filter((u) => u !== myId);
    await this.eventsRepository.delete(event.id);
    if (others.length) {
      await this.notify(
        workspace,
        others,
        `🗑 **${event.title}** 일정이 취소되었습니다. (🕒 ${formatWhen(
          event.startAt,
          event.endAt,
          event.allDay,
        )})`,
        `[슐랙] 일정 취소: ${event.title}`,
      );
    }
    this.changed(url, event.id);
  }

  async rsvp(
    url: string,
    id: number,
    status: 'accepted' | 'declined',
    myId: number,
  ) {
    const { workspace, event } = await this.load(url, id, myId);
    if (event.OwnerId === myId) {
      throw new BadRequestException('주최자는 참석 응답을 할 수 없습니다.');
    }
    const me = (event.Attendees || []).find((a) => a.UserId === myId);
    if (!me) {
      throw new ForbiddenException('초대받은 사람만 응답할 수 있습니다.');
    }
    await this.attendeesRepository.update(
      { EventId: event.id, UserId: myId },
      { status },
    );
    if (event.OwnerId) {
      const name = me.User?.nickname || '참석자';
      await this.notify(
        workspace,
        [event.OwnerId],
        status === 'accepted'
          ? `✅ **${name}** 님이 **${event.title}** 참석을 수락했습니다.`
          : `❌ **${name}** 님이 **${event.title}** 참석을 거절했습니다.`,
        `[슐랙] 참석 응답: ${event.title}`,
      );
    }
    this.changed(url, event.id);
    const { event: fresh } = await this.load(url, event.id, myId);
    return this.present(fresh, myId);
  }

  async getFollows(url: string, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    const rows = await this.followsRepository.find({
      where: { WorkspaceId: workspace.id, UserId: myId },
      relations: ['Following'],
    });
    return rows.map((row) => row.Following).filter(Boolean);
  }

  async follow(url: string, userId: number, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    if (userId === myId) {
      throw new BadRequestException('내 캘린더는 이미 보입니다.');
    }
    await this.workspacesService.assertMember(workspace.id, userId);
    if (await this.botsService.isBot(userId)) {
      throw new BadRequestException('봇에게는 캘린더가 없습니다.');
    }
    await this.followsRepository.save({
      WorkspaceId: workspace.id,
      UserId: myId,
      FollowingId: userId,
    });
  }

  async unfollow(url: string, userId: number, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    await this.followsRepository.delete({
      WorkspaceId: workspace.id,
      UserId: myId,
      FollowingId: userId,
    });
  }

  async getBot(url: string, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    return { id: await this.botsService.ensureMember(workspace.id) };
  }

  // 15초마다: 알림 시각이 된 일정을 참석자에게 알린다 (한 번만)
  async tick(now = new Date()) {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.sendDueReminders(now);
    } catch (error) {
      this.logger.error(`일정 알림 처리 실패: ${error.message}`);
    } finally {
      this.running = false;
    }
  }

  async sendDueReminders(now: Date) {
    const candidates = await this.eventsRepository.find({
      where: {
        reminderMinutes: Not(IsNull()),
        remindedAt: IsNull(),
        startAt: Between(
          new Date(now.getTime() - LATE_MS),
          new Date(now.getTime() + MAX_REMINDER_MINUTES * 60_000),
        ),
      },
      relations: ['Workspace', 'Attendees', 'Owner'],
    });
    for (const event of candidates) {
      const remindAt =
        event.startAt.getTime() - (event.reminderMinutes || 0) * 60_000;
      if (remindAt > now.getTime() || !event.Workspace) {
        continue;
      }
      // 같은 일정을 두 번 알리지 않도록 먼저 표시한다
      const result = await this.eventsRepository.update(
        { id: event.id, remindedAt: IsNull() },
        { remindedAt: now },
      );
      if (!result.affected) {
        continue;
      }
      const targets = (event.Attendees || [])
        .filter((a) => a.status !== 'declined')
        .map((a) => a.UserId);
      if (event.OwnerId && !targets.includes(event.OwnerId)) {
        targets.push(event.OwnerId);
      }
      await this.notify(
        event.Workspace,
        targets,
        this.reminderText(event, event.Workspace.url),
        `[슐랙] 일정 알림: ${event.title}`,
      );
    }
  }
}
