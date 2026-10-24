import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { In, LessThan, Repository } from 'typeorm';
import { ChannelsService } from '../channels/channels.service';
import { DmsService } from '../dms/dms.service';
import { AppCommands } from '../entities/AppCommands';
import { AppTickets } from '../entities/AppTickets';
import { ChannelChats } from '../entities/ChannelChats';
import { DMs } from '../entities/DMs';
import { Apps } from '../entities/Apps';
import { ChannelMembers } from '../entities/ChannelMembers';
import { Channels } from '../entities/Channels';
import { Reactions } from '../entities/Reactions';
import { Users } from '../entities/Users';
import { WorkspaceMembers } from '../entities/WorkspaceMembers';
import { EventsGateway } from '../events/events.gateway';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { AppEventsService, AppEventType } from './app-events.service';
import { assertAppUrl, postToApp } from './app-http';
import { AppButton, parseAppMessage, toAppMessage } from './app-message';

// 슐랙에 원래 있는 명령 (앱이 같은 이름을 쓸 수 없다)
const BUILTIN_COMMANDS = [
  'remind',
  'poll',
  'status',
  'away',
  'back',
  'topic',
  'mute',
  'unmute',
  'shrug',
  'help',
];
// response_url: 명령에 늦게 답할 수 있는 시간과 횟수
const RESPONSE_TTL_MS = 30 * 60_000;
const RESPONSE_MAX_USES = 5;
const appUrl = () =>
  (process.env.APP_URL || 'http://localhost:3090').replace(/\/$/, '');

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');
const newToken = () => `shb-${randomBytes(24).toString('hex')}`;

// 봇 토큰으로 부르는 앱 API 에서 쓰는 앱 정보
export interface AppContext {
  app: Apps;
  url: string;
}

interface ResponseTicket {
  id?: number;
  appId: number;
  appName: string;
  botUserId: number;
  url: string;
  userId: number;
  channel: string | null;
  dmUserId: number | null;
  expires: number;
  uses: number;
}

export interface CommandResult {
  posted?: boolean;
  ephemeral?: { appName: string; text: string; error?: boolean };
}

@Injectable()
export class AppsService {
  private logger = new Logger('Apps');

  constructor(
    @InjectRepository(Apps) private appsRepository: Repository<Apps>,
    @InjectRepository(AppCommands)
    private commandsRepository: Repository<AppCommands>,
    @InjectRepository(Users) private usersRepository: Repository<Users>,
    @InjectRepository(WorkspaceMembers)
    private membersRepository: Repository<WorkspaceMembers>,
    @InjectRepository(Channels)
    private channelsRepository: Repository<Channels>,
    @InjectRepository(ChannelMembers)
    private channelMembersRepository: Repository<ChannelMembers>,
    @InjectRepository(Reactions)
    private reactionsRepository: Repository<Reactions>,
    @InjectRepository(AppTickets)
    private ticketsRepository: Repository<AppTickets>,
    @InjectRepository(ChannelChats)
    private chatsRepository: Repository<ChannelChats>,
    @InjectRepository(DMs)
    private dmsRepository: Repository<DMs>,
    private workspacesService: WorkspacesService,
    private channelsService: ChannelsService,
    private dmsService: DmsService,
    private eventsGateway: EventsGateway,
    private appEvents: AppEventsService,
  ) {}

  // ── 관리 (워크스페이스 관리자)

  private async adminWorkspace(url: string, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertRole(
      workspace.id,
      myId,
      'admin',
      '워크스페이스 관리자만 앱을 관리할 수 있습니다.',
    );
    return workspace;
  }

  private async findApp(workspaceId: number, appId: number) {
    const app = await this.appsRepository.findOne({
      where: { id: appId, WorkspaceId: workspaceId },
    });
    if (!app) {
      throw new NotFoundException('존재하지 않는 앱입니다.');
    }
    return app;
  }

  private async view(app: Apps) {
    const [bot, commands, channels] = await Promise.all([
      this.usersRepository.findOne({
        where: { id: app.BotUserId },
        select: ['id', 'nickname', 'email', 'avatarStyle'],
      }),
      this.commandsRepository.find({
        where: { AppId: app.id },
        order: { command: 'ASC' },
      }),
      this.channelsRepository
        .createQueryBuilder('c')
        .innerJoin(
          ChannelMembers,
          'm',
          'm.ChannelId = c.id AND m.UserId = :bot',
          { bot: app.BotUserId },
        )
        .select(['c.id', 'c.name', 'c.private'])
        .orderBy('c.name', 'ASC')
        .getMany(),
    ]);
    return {
      id: app.id,
      name: app.name,
      description: app.description,
      tokenHint: app.tokenHint,
      eventUrl: app.eventUrl,
      interactionUrl: app.interactionUrl,
      events: app.events ? app.events.split(',') : [],
      lastEventAt: app.lastEventAt,
      lastEventError: app.lastEventError,
      createdAt: app.createdAt,
      bot,
      commands: commands.map((c) => ({
        id: c.id,
        command: c.command,
        url: c.url,
        description: c.description,
        usageHint: c.usageHint,
      })),
      channels: channels.map((c) => ({ name: c.name, private: c.private })),
    };
  }

  async list(url: string, myId: number) {
    const workspace = await this.adminWorkspace(url, myId);
    const apps = await this.appsRepository.find({
      where: { WorkspaceId: workspace.id },
      order: { createdAt: 'ASC' },
    });
    return Promise.all(apps.map((app) => this.view(app)));
  }

  // 앱 만들기: 봇 계정을 만들어 워크스페이스에 넣고, 토큰은 이때 한 번만 보여 준다
  async create(
    url: string,
    dto: { name: string; description?: string },
    myId: number,
  ) {
    const workspace = await this.adminWorkspace(url, myId);
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('앱 이름을 입력해주세요.');
    }
    const bot = await this.usersRepository.save({
      email: `app-${randomBytes(6).toString('hex')}@bot.shlack`,
      nickname: name,
      bot: true,
      // 로그인할 수 없도록 아무도 모르는 비밀번호
      password: await bcrypt.hash(randomBytes(32).toString('hex'), 4),
    });
    await this.membersRepository.save({
      WorkspaceId: workspace.id,
      UserId: bot.id,
    });
    const token = newToken();
    const app = await this.appsRepository.save({
      WorkspaceId: workspace.id,
      name,
      description: dto.description?.trim() || null,
      BotUserId: bot.id,
      tokenHash: hashToken(token),
      tokenHint: token.slice(-4),
      signingSecret: randomBytes(24).toString('hex'),
      events: '',
      CreatorId: myId,
    });
    this.eventsGateway.emitToWorkspace(url, 'membersChanged');
    return { ...(await this.view(app)), token };
  }

  async update(
    url: string,
    appId: number,
    dto: {
      name?: string;
      description?: string;
      eventUrl?: string | null;
      interactionUrl?: string | null;
      events?: AppEventType[];
    },
    myId: number,
  ) {
    const workspace = await this.adminWorkspace(url, myId);
    const app = await this.findApp(workspace.id, appId);
    const update: Partial<Apps> = {};
    if (dto.interactionUrl !== undefined) {
      const next = dto.interactionUrl?.trim() || null;
      if (next) {
        try {
          assertAppUrl(next);
        } catch (error) {
          throw new BadRequestException((error as Error).message);
        }
      }
      update.interactionUrl = next;
    }
    if (dto.name !== undefined && dto.name.trim() !== app.name) {
      update.name = dto.name.trim();
      await this.usersRepository.update(app.BotUserId, {
        nickname: update.name,
      });
      this.eventsGateway.emitToWorkspace(url, 'membersChanged');
    }
    if (dto.description !== undefined) {
      update.description = dto.description.trim() || null;
    }
    if (dto.events !== undefined) {
      update.events = [...new Set(dto.events)].join(',');
    }
    if (dto.eventUrl !== undefined) {
      const next = dto.eventUrl?.trim() || null;
      if (next && next !== app.eventUrl) {
        await this.verifyEventUrl(app.id, next);
      }
      update.eventUrl = next;
      update.lastEventError = null;
    }
    if (Object.keys(update).length) {
      await this.appsRepository.update(app.id, update);
      this.appEvents.invalidate(workspace.id);
    }
    return this.view({ ...app, ...update } as Apps);
  }

  // 이벤트 주소 확인: challenge 를 보내 그대로 돌려주는지 본다 (그 주소가 정말 이 앱의 것인지)
  private async verifyEventUrl(appId: number, eventUrl: string) {
    try {
      assertAppUrl(eventUrl);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    const secret = await this.secretOf(appId);
    const challenge = randomBytes(16).toString('hex');
    let response;
    try {
      response = await postToApp(
        eventUrl,
        { type: 'url_verification', challenge },
        secret,
      );
    } catch (error) {
      throw new BadRequestException(
        `이벤트 주소에 연결하지 못했습니다: ${(error as Error).message}`,
      );
    }
    let answered = response.body.trim();
    try {
      answered = JSON.parse(response.body)?.challenge ?? answered;
    } catch {
      // 글로 답해도 된다
    }
    if (response.status !== 200 || answered !== challenge) {
      throw new BadRequestException(
        '이벤트 주소가 확인 요청(challenge)에 올바르게 답하지 않았습니다.',
      );
    }
  }

  private async secretOf(appId: number) {
    const row = await this.appsRepository.findOne({
      where: { id: appId },
      select: ['id', 'signingSecret'],
    });
    return row!.signingSecret;
  }

  async revealSecret(url: string, appId: number, myId: number) {
    const workspace = await this.adminWorkspace(url, myId);
    const app = await this.findApp(workspace.id, appId);
    return { signingSecret: await this.secretOf(app.id) };
  }

  // 토큰을 다시 만들면 예전 토큰은 바로 못 쓴다
  async regenerateToken(url: string, appId: number, myId: number) {
    const workspace = await this.adminWorkspace(url, myId);
    const app = await this.findApp(workspace.id, appId);
    const token = newToken();
    await this.appsRepository.update(app.id, {
      tokenHash: hashToken(token),
      tokenHint: token.slice(-4),
    });
    return { token, tokenHint: token.slice(-4) };
  }

  // 앱 지우기: 봇은 워크스페이스·채널에서 빼고, 이미 쓴 메시지는 남긴다
  async remove(url: string, appId: number, myId: number) {
    const workspace = await this.adminWorkspace(url, myId);
    const app = await this.findApp(workspace.id, appId);
    await this.appsRepository.delete(app.id);
    const channels = await this.channelsRepository.find({
      where: { WorkspaceId: workspace.id },
      select: ['id'],
    });
    if (channels.length) {
      await this.channelMembersRepository.delete({
        UserId: app.BotUserId,
        ChannelId: In(channels.map((c) => c.id)),
      });
    }
    await this.membersRepository.delete({
      WorkspaceId: workspace.id,
      UserId: app.BotUserId,
    });
    this.appEvents.invalidate(workspace.id);
    this.eventsGateway.emitToWorkspace(url, 'membersChanged');
  }

  // 앱을 채널에 넣기 (넣는 관리자도 그 채널 멤버여야 한다)
  async addToChannel(
    url: string,
    appId: number,
    channel: string,
    myId: number,
  ) {
    const workspace = await this.adminWorkspace(url, myId);
    const app = await this.findApp(workspace.id, appId);
    const bot = await this.usersRepository.findOne({
      where: { id: app.BotUserId },
      select: ['id', 'email'],
    });
    await this.channelsService.createWorkspaceChannelMembers(
      url,
      channel,
      bot!.email,
      myId,
    );
    return this.view(app);
  }

  async removeFromChannel(
    url: string,
    appId: number,
    channel: string,
    myId: number,
  ) {
    const workspace = await this.adminWorkspace(url, myId);
    const app = await this.findApp(workspace.id, appId);
    const row = await this.channelsRepository.findOne({
      where: { WorkspaceId: workspace.id, name: channel },
    });
    if (row) {
      await this.channelMembersRepository.delete({
        ChannelId: row.id,
        UserId: app.BotUserId,
      });
    }
    return this.view(app);
  }

  async addCommand(
    url: string,
    appId: number,
    dto: {
      command: string;
      url: string;
      description?: string;
      usageHint?: string;
    },
    myId: number,
  ) {
    const workspace = await this.adminWorkspace(url, myId);
    const app = await this.findApp(workspace.id, appId);
    const command = dto.command.toLowerCase();
    if (BUILTIN_COMMANDS.includes(command)) {
      throw new BadRequestException(`/${command} 는 슐랙 기본 명령입니다.`);
    }
    try {
      assertAppUrl(dto.url);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    const taken = await this.commandsRepository.findOne({
      where: { WorkspaceId: workspace.id, command },
    });
    if (taken) {
      throw new BadRequestException(
        `/${command} 는 이미 다른 앱이 쓰고 있습니다.`,
      );
    }
    await this.commandsRepository.save({
      AppId: app.id,
      WorkspaceId: workspace.id,
      command,
      url: dto.url.trim(),
      description: dto.description?.trim() || null,
      usageHint: dto.usageHint?.trim() || null,
    });
    this.eventsGateway.emitToWorkspace(url, 'appCommandsChanged');
    return this.view(app);
  }

  async removeCommand(
    url: string,
    appId: number,
    commandId: number,
    myId: number,
  ) {
    const workspace = await this.adminWorkspace(url, myId);
    const app = await this.findApp(workspace.id, appId);
    await this.commandsRepository.delete({ id: commandId, AppId: app.id });
    this.eventsGateway.emitToWorkspace(url, 'appCommandsChanged');
    return this.view(app);
  }

  // ── 슬래시 명령 (멤버)

  async listCommands(url: string, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertMember(workspace.id, myId);
    const rows = await this.commandsRepository.find({
      where: { WorkspaceId: workspace.id },
      relations: ['App'],
      order: { command: 'ASC' },
    });
    return rows.map((c) => ({
      command: c.command,
      description: c.description,
      usageHint: c.usageHint,
      appName: c.App?.name,
    }));
  }

  async runCommand(
    url: string,
    dto: {
      command: string;
      text?: string;
      channel?: string;
      dmUserId?: number;
    },
    myId: number,
  ): Promise<CommandResult> {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertMember(workspace.id, myId);
    if (!dto.channel === !dto.dmUserId) {
      throw new BadRequestException('명령을 입력한 대화를 알려주세요.');
    }
    const command = await this.commandsRepository.findOne({
      where: { WorkspaceId: workspace.id, command: dto.command.toLowerCase() },
      relations: ['App'],
    });
    if (!command?.App) {
      throw new NotFoundException(`/${dto.command} 명령이 없습니다.`);
    }
    // 그 대화에 쓸 수 있는 사람만 명령을 쓴다
    if (dto.channel) {
      const channel = await this.channelsRepository.findOne({
        where: { WorkspaceId: workspace.id, name: dto.channel },
      });
      const member =
        channel &&
        (await this.channelMembersRepository.findOne({
          where: { ChannelId: channel.id, UserId: myId },
        }));
      if (!member) {
        throw new NotFoundException('존재하지 않는 채널입니다.');
      }
      if (channel.archived) {
        throw new ForbiddenException('보관된 채널에는 쓸 수 없습니다.');
      }
    } else {
      await this.workspacesService.assertMember(workspace.id, dto.dmUserId!);
    }
    const user = await this.usersRepository.findOne({
      where: { id: myId },
      select: ['id', 'nickname'],
    });
    const app = command.App;
    const { token: ticketId, ticket } = await this.createTicket(
      app,
      url,
      myId,
      dto.channel || null,
      dto.dmUserId || null,
    );
    const payload = {
      type: 'slash_command',
      app_id: app.id,
      workspace: url,
      command: `/${command.command}`,
      text: dto.text?.trim() || '',
      user: { id: myId, nickname: user?.nickname },
      channel: dto.channel || null,
      channel_type: dto.channel ? 'channel' : 'im',
      response_url: `${appUrl()}/api/apps/respond/${ticketId}`,
    };
    let response;
    try {
      response = await postToApp(
        command.url,
        payload,
        await this.secretOf(app.id),
      );
    } catch (error) {
      return {
        ephemeral: {
          appName: app.name,
          text: `앱이 응답하지 않았어요. (${(error as Error).message})`,
          error: true,
        },
      };
    }
    if (response.status < 200 || response.status >= 300) {
      return {
        ephemeral: {
          appName: app.name,
          text: `앱이 오류를 돌려줬어요. (HTTP ${response.status})`,
          error: true,
        },
      };
    }
    const body = response.body.trim();
    if (!body) {
      return {};
    }
    let reply: { text?: string; response_type?: string } = { text: body };
    try {
      const parsed = JSON.parse(body);
      reply = typeof parsed === 'object' && parsed ? parsed : { text: body };
    } catch {
      // 글로 답하면 나에게만 보여 준다
    }
    return this.deliverReply(ticket, reply);
  }

  // 앱의 답: in_channel 이면 앱 봇이 채널에 올리고, 아니면 명령을 쓴 사람에게만 보여 준다
  private async deliverReply(
    ticket: ResponseTicket,
    reply: { text?: unknown; response_type?: unknown },
  ): Promise<CommandResult> {
    const text = typeof reply.text === 'string' ? reply.text.trim() : '';
    if (!text) {
      return {};
    }
    if (reply.response_type === 'in_channel' && ticket.channel) {
      try {
        await this.channelsService.postChat(
          ticket.url,
          ticket.channel,
          text.slice(0, 8000),
          ticket.botUserId,
        );
        return { posted: true };
      } catch {
        return {
          ephemeral: {
            appName: ticket.appName,
            text: `${text}\n\n(앱이 이 채널에 없어서 나에게만 보여요. 채널에 올리려면 관리자가 앱을 채널에 넣어 주세요.)`,
          },
        };
      }
    }
    return {
      ephemeral: { appName: ticket.appName, text: text.slice(0, 8000) },
    };
  }

  // response_url: 앱이 시간이 걸리는 일을 끝낸 뒤 답한다 (30분 동안 5번까지)
  async respond(
    ticketId: string,
    reply: { text?: string; response_type?: string },
  ) {
    const row = await this.ticketsRepository.findOne({
      where: { tokenHash: hashToken(ticketId) },
      relations: ['App'],
    });
    if (
      !row?.App ||
      row.expiresAt.getTime() < Date.now() ||
      row.uses >= RESPONSE_MAX_USES
    ) {
      throw new NotFoundException('만료되었거나 없는 응답 주소입니다.');
    }
    await this.ticketsRepository.update(row.id, { uses: row.uses + 1 });
    const ticket = this.ticketOf(row);
    const result = await this.deliverReply(ticket, reply);
    if (result.ephemeral) this.ephemeralTo(ticket, result.ephemeral);
    return { ok: true };
  }

  // 늦은 답 주소 만들기 (토큰은 주소에만, DB 에는 해시). 만료된 것은 이때 지운다
  private async createTicket(
    app: Apps,
    url: string,
    userId: number,
    channel: string | null,
    dmUserId: number | null,
  ) {
    await this.ticketsRepository.delete({ expiresAt: LessThan(new Date()) });
    const token = randomBytes(18).toString('hex');
    const row = await this.ticketsRepository.save({
      tokenHash: hashToken(token),
      AppId: app.id,
      url,
      UserId: userId,
      channel,
      dmUserId,
      expiresAt: new Date(Date.now() + RESPONSE_TTL_MS),
      uses: 0,
    });
    return { token, ticket: this.ticketOf({ ...row, App: app } as AppTickets) };
  }

  private ticketOf(row: AppTickets): ResponseTicket {
    return {
      id: row.id,
      appId: row.AppId,
      appName: row.App.name,
      botUserId: row.App.BotUserId,
      url: row.url,
      userId: row.UserId,
      channel: row.channel,
      dmUserId: row.dmUserId,
      expires: row.expiresAt.getTime(),
      uses: row.uses,
    };
  }

  private ephemeralTo(
    ticket: ResponseTicket,
    ephemeral: CommandResult['ephemeral'],
  ) {
    this.eventsGateway.emitToUser(ticket.url, ticket.userId, 'appEphemeral', {
      ...ephemeral,
      channel: ticket.channel,
      dmUserId: ticket.dmUserId,
    });
  }

  // ── 메시지 버튼

  // 앱 메시지의 버튼을 눌렀다: 앱의 버튼 주소(없으면 이벤트 주소)로 보내고, 앱의 답에 따라
  // 원래 메시지를 바꾸거나(replace_original) 채널에 올리거나 누른 사람에게만 보여 준다
  async runAction(
    url: string,
    dto: { chatId?: number; dmId?: number; actionId: string },
    myId: number,
  ) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertMember(workspace.id, myId);
    if (!dto.chatId === !dto.dmId) {
      throw new BadRequestException('메시지를 하나 지정하세요.');
    }
    let content: string;
    let authorId: number | null;
    let channelName: string | null = null;
    let dm: DMs | null = null;
    if (dto.chatId) {
      const chat = await this.chatsRepository.findOne({
        where: { id: dto.chatId },
        relations: ['Channel'],
      });
      const member =
        chat?.Channel?.WorkspaceId === workspace.id &&
        (await this.channelMembersRepository.findOne({
          where: { ChannelId: chat.ChannelId, UserId: myId },
        }));
      if (!member) throw new NotFoundException('존재하지 않는 메시지입니다.');
      if (chat.Channel.archived) {
        throw new ForbiddenException('보관된 채널입니다.');
      }
      content = chat.content;
      authorId = chat.UserId;
      channelName = chat.Channel.name;
    } else {
      dm = await this.dmsRepository.findOne({
        where: { id: dto.dmId, WorkspaceId: workspace.id },
      });
      if (!dm || (dm.SenderId !== myId && dm.ReceiverId !== myId)) {
        throw new NotFoundException('존재하지 않는 메시지입니다.');
      }
      content = dm.content;
      authorId = dm.SenderId;
    }
    const app = authorId
      ? await this.appsRepository.findOne({
          where: { WorkspaceId: workspace.id, BotUserId: authorId },
        })
      : null;
    const message = parseAppMessage(content);
    const button = message?.buttons.find((b) => b.id === dto.actionId);
    if (!app || !message || !button) {
      throw new BadRequestException('누를 수 없는 버튼입니다.');
    }
    const target = app.interactionUrl || app.eventUrl;
    if (!target) {
      throw new BadRequestException(
        '앱이 버튼을 받을 주소를 정하지 않았습니다.',
      );
    }
    const { token, ticket } = await this.createTicket(
      app,
      url,
      myId,
      channelName,
      dm ? app.BotUserId : null,
    );
    const user = await this.usersRepository.findOne({
      where: { id: myId },
      select: ['id', 'nickname'],
    });
    const payload = {
      type: 'block_action',
      app_id: app.id,
      workspace: url,
      user: { id: myId, nickname: user?.nickname },
      channel: channelName,
      channel_type: channelName ? 'channel' : 'im',
      message_id: dto.chatId || dto.dmId,
      message_text: message.text,
      action: {
        id: button.id,
        label: button.label,
        value: button.value ?? null,
      },
      response_url: `${appUrl()}/api/apps/respond/${token}`,
    };
    let response;
    try {
      response = await postToApp(target, payload, await this.secretOf(app.id));
    } catch (error) {
      this.ephemeralTo(ticket, {
        appName: app.name,
        text: `앱이 응답하지 않았어요. (${(error as Error).message})`,
        error: true,
      });
      return { ok: false };
    }
    if (response.status < 200 || response.status >= 300) {
      this.ephemeralTo(ticket, {
        appName: app.name,
        text: `앱이 오류를 돌려줬어요. (HTTP ${response.status})`,
        error: true,
      });
      return { ok: false };
    }
    let reply: {
      text?: unknown;
      response_type?: unknown;
      replace_original?: unknown;
      buttons?: unknown;
    } = {};
    try {
      const parsed = response.body.trim() ? JSON.parse(response.body) : {};
      reply = typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
      reply = { text: response.body.trim() };
    }
    // 원래 메시지 바꾸기 (예: 버튼을 떼고 "✅ 승인됨")
    if (
      reply.replace_original === true &&
      typeof reply.text === 'string' &&
      reply.text.trim()
    ) {
      const buttons = this.safeButtons(reply.buttons);
      const next = toAppMessage(reply.text.trim().slice(0, 8000), buttons);
      if (channelName) {
        await this.channelsService.editChat(
          url,
          channelName,
          dto.chatId!,
          next,
          app.BotUserId,
        );
      } else {
        await this.dmsService.editDM(
          url,
          dm!.SenderId === app.BotUserId ? dm!.ReceiverId : dm!.SenderId,
          dm!.id,
          next,
          app.BotUserId,
        );
      }
      return { ok: true, replaced: true };
    }
    const result = await this.deliverReply(ticket, reply);
    if (result.ephemeral) this.ephemeralTo(ticket, result.ephemeral);
    return { ok: true, posted: !!result.posted };
  }

  // 앱이 답으로 보낸 버튼 (형식이 맞는 것만)
  private safeButtons(value: unknown): AppButton[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (b) =>
          b &&
          typeof b.id === 'string' &&
          /^[\w-]{1,40}$/.test(b.id) &&
          typeof b.label === 'string' &&
          b.label.trim(),
      )
      .slice(0, 5)
      .map((b) => ({
        id: b.id,
        label: String(b.label).slice(0, 30),
        ...(b.style === 'primary' || b.style === 'danger'
          ? { style: b.style }
          : {}),
        ...(typeof b.value === 'string'
          ? { value: b.value.slice(0, 200) }
          : {}),
      }));
  }

  // ── 앱 API (봇 토큰)

  async authenticate(token: string): Promise<AppContext | null> {
    if (!token) return null;
    const app = await this.appsRepository.findOne({
      where: { tokenHash: hashToken(token) },
      relations: ['Workspace'],
    });
    if (!app?.Workspace) return null;
    return { app, url: app.Workspace.url };
  }

  async authTest(ctx: AppContext) {
    const bot = await this.usersRepository.findOne({
      where: { id: ctx.app.BotUserId },
      select: ['id', 'nickname'],
    });
    return {
      ok: true,
      app: { id: ctx.app.id, name: ctx.app.name },
      bot,
      workspace: ctx.url,
    };
  }

  // 공개 채널과 앱이 들어간 비공개 채널
  async channels(ctx: AppContext) {
    const rows = await this.channelsRepository
      .createQueryBuilder('c')
      .leftJoin(ChannelMembers, 'm', 'm.ChannelId = c.id AND m.UserId = :bot', {
        bot: ctx.app.BotUserId,
      })
      .select([
        'c.id AS id',
        'c.name AS name',
        'c.private AS private',
        'c.archived AS archived',
        'm.UserId AS member',
      ])
      .where('c.WorkspaceId = :ws', { ws: ctx.app.WorkspaceId })
      .andWhere('(c.private = 0 OR m.UserId IS NOT NULL)')
      .orderBy('c.name', 'ASC')
      .getRawMany();
    return rows.map((r) => ({
      name: r.name,
      private: !!Number(r.private),
      archived: !!Number(r.archived),
      isMember: !!r.member,
    }));
  }

  async users(ctx: AppContext) {
    const rows = await this.membersRepository
      .createQueryBuilder('m')
      .innerJoin('m.User', 'u')
      .select([
        'u.id AS id',
        'u.nickname AS nickname',
        'u.email AS email',
        'u.bot AS bot',
        'm.role AS role',
      ])
      .where('m.WorkspaceId = :ws', { ws: ctx.app.WorkspaceId })
      .orderBy('u.nickname', 'ASC')
      .getRawMany();
    return rows.map((r) => ({
      id: Number(r.id),
      nickname: r.nickname,
      email: r.email,
      bot: !!Number(r.bot),
      role: r.role,
    }));
  }

  private target(dto: { channel?: string; userId?: number }) {
    if (!dto.channel === !dto.userId) {
      throw new BadRequestException('channel 과 userId 중 하나만 주세요.');
    }
  }

  async postMessage(
    ctx: AppContext,
    dto: {
      channel?: string;
      userId?: number;
      text: string;
      threadId?: number;
      buttons?: AppButton[];
    },
  ) {
    this.target(dto);
    const bot = ctx.app.BotUserId;
    const content = toAppMessage(dto.text, dto.buttons);
    if (dto.channel) {
      const chat = dto.threadId
        ? await this.channelsService.postReply(
            ctx.url,
            dto.channel,
            dto.threadId,
            content,
            bot,
          )
        : await this.channelsService.postChat(
            ctx.url,
            dto.channel,
            content,
            bot,
          );
      return { ok: true, messageId: chat.id, channel: dto.channel };
    }
    if (dto.threadId) {
      throw new BadRequestException('DM 에는 스레드가 없습니다.');
    }
    const dm = await this.dmsService.createWorkspaceDMChats(
      ctx.url,
      content,
      dto.userId!,
      bot,
    );
    return { ok: true, messageId: dm.id, userId: dto.userId };
  }

  async updateMessage(
    ctx: AppContext,
    dto: {
      channel?: string;
      userId?: number;
      messageId: number;
      text: string;
      buttons?: AppButton[];
    },
  ) {
    this.target(dto);
    const bot = ctx.app.BotUserId;
    const content = toAppMessage(dto.text, dto.buttons);
    if (dto.channel) {
      await this.channelsService.editChat(
        ctx.url,
        dto.channel,
        dto.messageId,
        content,
        bot,
      );
    } else {
      await this.dmsService.editDM(
        ctx.url,
        dto.userId!,
        dto.messageId,
        content,
        bot,
      );
    }
    return { ok: true, messageId: dto.messageId };
  }

  async deleteMessage(
    ctx: AppContext,
    dto: { channel?: string; userId?: number; messageId: number },
  ) {
    this.target(dto);
    const bot = ctx.app.BotUserId;
    if (dto.channel) {
      // 앱은 관리자 권한이 없으니 자기 메시지만 지운다
      await this.channelsService.deleteChat(
        ctx.url,
        dto.channel,
        dto.messageId,
        bot,
      );
    } else {
      await this.dmsService.deleteDM(ctx.url, dto.userId!, dto.messageId, bot);
    }
    return { ok: true };
  }

  // 리액션 달기 (이미 달았으면 그대로)
  async addReaction(
    ctx: AppContext,
    dto: { channel: string; messageId: number; emoji: string },
  ) {
    const existing = await this.reactionsRepository.findOne({
      where: {
        ChatId: dto.messageId,
        UserId: ctx.app.BotUserId,
        emoji: dto.emoji,
      },
    });
    if (!existing) {
      await this.channelsService.toggleReaction(
        ctx.url,
        dto.channel,
        dto.messageId,
        dto.emoji,
        ctx.app.BotUserId,
      );
    }
    return { ok: true };
  }
}
