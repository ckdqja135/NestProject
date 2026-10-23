import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BotsService } from '../bots/bots.service';
import { DmsService } from '../dms/dms.service';
import { CalendarAttendees } from '../entities/CalendarAttendees';
import { CalendarEvents } from '../entities/CalendarEvents';
import { CalendarFollows } from '../entities/CalendarFollows';
import { Users } from '../entities/Users';
import { EventsGateway } from '../events/events.gateway';
import { MailService } from '../mail/mail.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { CalendarService, formatWhen, reminderLabel } from './calendar.service';

describe('CalendarService', () => {
  let service: CalendarService;
  const eventsRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn((v) => ({ id: 10, ...v })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn(),
  };
  const attendeesRepository = {
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const followsRepository = {
    find: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const usersRepository = { find: jest.fn(), findOne: jest.fn() };
  const workspace = { id: 1, url: 'ws', OwnerId: 1 };
  const workspacesService = {
    findWorkspaceByUrl: jest.fn().mockResolvedValue(workspace),
    assertMember: jest.fn().mockResolvedValue('member'),
    roleOf: jest.fn().mockResolvedValue('member'),
  };
  const dmsService = { createWorkspaceDMChats: jest.fn() };
  const botsService = {
    ensureMember: jest.fn().mockResolvedValue(77),
    isBot: jest.fn().mockResolvedValue(false),
  };
  const eventsGateway = {
    emitToWorkspace: jest.fn(),
    isOnline: jest.fn().mockReturnValue(true),
  };
  const mailService = {
    isEnabled: jest.fn().mockReturnValue(true),
    send: jest.fn(),
  };

  const start = new Date('2026-10-20T05:00:00Z'); // 14:00 KST
  const end = new Date('2026-10-20T06:00:00Z');
  const event = (over = {}) => ({
    id: 5,
    WorkspaceId: 1,
    title: '주간 회의',
    location: null,
    startAt: start,
    endAt: end,
    allDay: false,
    visibility: 'public',
    reminderMinutes: 10,
    remindedAt: null,
    OwnerId: 1,
    Owner: { id: 1, nickname: '주최자' },
    Attendees: [
      { UserId: 1, status: 'accepted', User: { id: 1, nickname: '주최자' } },
      { UserId: 2, status: 'pending', User: { id: 2, nickname: '참석자' } },
      { UserId: 3, status: 'declined', User: { id: 3, nickname: '거절자' } },
    ],
    ...over,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        {
          provide: getRepositoryToken(CalendarEvents),
          useValue: eventsRepository,
        },
        {
          provide: getRepositoryToken(CalendarAttendees),
          useValue: attendeesRepository,
        },
        {
          provide: getRepositoryToken(CalendarFollows),
          useValue: followsRepository,
        },
        { provide: getRepositoryToken(Users), useValue: usersRepository },
        { provide: WorkspacesService, useValue: workspacesService },
        { provide: DmsService, useValue: dmsService },
        { provide: BotsService, useValue: botsService },
        { provide: EventsGateway, useValue: eventsGateway },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();
    service = module.get(CalendarService);
    eventsRepository.update.mockResolvedValue({ affected: 1 });
    eventsGateway.isOnline.mockReturnValue(true);
  });

  it('시각을 한국어로 보여 준다', () => {
    expect(formatWhen(start, end, false)).toBe('10월 20일 (화) 14:00 ~ 15:00');
    expect(
      formatWhen(
        new Date('2026-10-19T15:00:00Z'),
        new Date('2026-10-20T15:00:00Z'),
        true,
      ),
    ).toBe('10월 20일 (화) 종일');
    expect(reminderLabel(10)).toBe('10분 전');
    expect(reminderLabel(120)).toBe('2시간 전');
    expect(reminderLabel(1440)).toBe('1일 전');
  });

  it('비공개 일정은 참석자가 아니면 없는 것처럼 보인다', async () => {
    eventsRepository.findOne.mockResolvedValue(
      event({ visibility: 'private' }),
    );
    await expect(service.getEvent('ws', 5, 9)).rejects.toThrow(
      NotFoundException,
    );
    const mine = await service.getEvent('ws', 5, 2);
    expect(mine.myStatus).toBe('pending');
  });

  it('주최자가 아니면 고치거나 지울 수 없다', async () => {
    eventsRepository.findOne.mockResolvedValue(event());
    await expect(
      service.updateEvent('ws', 5, { title: 'x' }, 2),
    ).rejects.toThrow(ForbiddenException);
    await expect(service.deleteEvent('ws', 5, 2)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('참석 응답은 초대받은 사람만, 주최자는 할 수 없다', async () => {
    eventsRepository.findOne.mockResolvedValue(event());
    await expect(service.rsvp('ws', 5, 'accepted', 9)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.rsvp('ws', 5, 'accepted', 1)).rejects.toThrow(
      BadRequestException,
    );
    await service.rsvp('ws', 5, 'accepted', 2);
    expect(attendeesRepository.update).toHaveBeenCalledWith(
      { EventId: 5, UserId: 2 },
      { status: 'accepted' },
    );
    // 주최자에게 봇이 알린다
    expect(dmsService.createWorkspaceDMChats).toHaveBeenCalledWith(
      'ws',
      expect.stringContaining('참석자'),
      1,
      77,
    );
  });

  it('끝이 시작보다 앞이거나 봇을 초대하면 만들 수 없다', async () => {
    await expect(
      service.createEvent(
        'ws',
        { title: 'x', startAt: end.toISOString(), endAt: start.toISOString() },
        1,
      ),
    ).rejects.toThrow(BadRequestException);
    usersRepository.find.mockResolvedValue([{ id: 77, bot: true }]);
    await expect(
      service.createEvent(
        'ws',
        {
          title: 'x',
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          attendeeIds: [77],
        },
        1,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('초대하면 참석자에게 봇 DM 을 보내고, 접속해 있지 않으면 메일도 보낸다', async () => {
    usersRepository.find.mockResolvedValue([{ id: 2, bot: false }]);
    usersRepository.findOne.mockResolvedValue({ id: 2, email: 'b@t.io' });
    eventsRepository.findOne.mockResolvedValue(event({ id: 10 }));
    eventsGateway.isOnline.mockReturnValue(false);
    const created = await service.createEvent(
      'ws',
      {
        title: '주간 회의',
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        attendeeIds: [2, 2, 1],
      },
      1,
    );
    expect(created.myStatus).toBe('owner');
    expect(attendeesRepository.save).toHaveBeenCalledWith([
      { EventId: 10, UserId: 1, status: 'accepted' },
      { EventId: 10, UserId: 2, status: 'pending' },
    ]);
    expect(dmsService.createWorkspaceDMChats).toHaveBeenCalledTimes(1);
    expect(dmsService.createWorkspaceDMChats.mock.calls[0][1]).toContain(
      '10월 20일 (화) 14:00 ~ 15:00',
    );
    expect(mailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'b@t.io',
        subject: '[슐랙] 일정 초대: 주간 회의',
      }),
    );
    expect(eventsGateway.emitToWorkspace).toHaveBeenCalledWith(
      'ws',
      'calendarChanged',
      {
        id: 10,
      },
    );
  });

  it('시작 10분 전에 거절하지 않은 사람에게 한 번만 알린다', async () => {
    const ev = event({ Workspace: workspace });
    eventsRepository.find.mockResolvedValue([ev]);
    // 아직 11분 남았으면 보내지 않는다
    await service.sendDueReminders(new Date(start.getTime() - 11 * 60_000));
    expect(dmsService.createWorkspaceDMChats).not.toHaveBeenCalled();
    await service.sendDueReminders(new Date(start.getTime() - 9 * 60_000));
    const sentTo = dmsService.createWorkspaceDMChats.mock.calls.map(
      (c) => c[2],
    );
    expect(sentTo.sort()).toEqual([1, 2]);
    expect(dmsService.createWorkspaceDMChats.mock.calls[0][1]).toContain(
      '10분 뒤에',
    );
    // 다른 서버가 먼저 표시했으면 (affected 0) 보내지 않는다
    dmsService.createWorkspaceDMChats.mockClear();
    eventsRepository.update.mockResolvedValue({ affected: 0 });
    await service.sendDueReminders(new Date(start.getTime() - 9 * 60_000));
    expect(dmsService.createWorkspaceDMChats).not.toHaveBeenCalled();
  });
});
