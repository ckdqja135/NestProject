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
import { LessThanOrEqual, Repository } from 'typeorm';
import { ChannelsService } from '../channels/channels.service';
import { DmsService } from '../dms/dms.service';
import { ChannelChats } from '../entities/ChannelChats';
import { ChannelMembers } from '../entities/ChannelMembers';
import { DMs } from '../entities/DMs';
import { Reminders } from '../entities/Reminders';
import { ScheduledMessages } from '../entities/ScheduledMessages';
import { EventsGateway } from '../events/events.gateway';
import { WorkspacesService } from '../workspaces/workspaces.service';

const TICK_MS = 15_000;
const MIN_DELAY_MS = 10_000; // 너무 가까운 시각은 그냥 보내면 되므로 막는다
const MAX_DELAY_MS = 365 * 24 * 60 * 60 * 1000;

@Injectable()
export class ScheduledService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('ScheduledService');
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @InjectRepository(ScheduledMessages)
    private scheduledRepository: Repository<ScheduledMessages>,
    @InjectRepository(Reminders)
    private remindersRepository: Repository<Reminders>,
    @InjectRepository(ChannelChats)
    private channelChatsRepository: Repository<ChannelChats>,
    @InjectRepository(ChannelMembers)
    private channelMembersRepository: Repository<ChannelMembers>,
    @InjectRepository(DMs)
    private dmsRepository: Repository<DMs>,
    private workspacesService: WorkspacesService,
    private channelsService: ChannelsService,
    private dmsService: DmsService,
    private eventsGateway: EventsGateway,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref?.();
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

  private parseTime(value: string) {
    const time = new Date(value);
    const delay = time.getTime() - Date.now();
    if (Number.isNaN(delay) || delay < MIN_DELAY_MS) {
      throw new BadRequestException('지금보다 나중 시각을 골라주세요.');
    }
    if (delay > MAX_DELAY_MS) {
      throw new BadRequestException('1년 이내의 시각만 고를 수 있습니다.');
    }
    return time;
  }

  // ── 예약 전송
  async getScheduled(url: string, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    return this.scheduledRepository.find({
      where: { UserId: myId, WorkspaceId: workspace.id },
      relations: ['Channel', 'Receiver'],
      order: { sendAt: 'ASC' },
    });
  }

  async createScheduled(
    url: string,
    dto: {
      channel?: string;
      receiverId?: number;
      content: string;
      sendAt: string;
    },
    myId: number,
  ) {
    const workspace = await this.findWorkspace(url, myId);
    if (!!dto.channel === !!dto.receiverId) {
      throw new BadRequestException(
        '채널이나 DM 받는 사람 중 하나를 지정하세요.',
      );
    }
    const sendAt = this.parseTime(dto.sendAt);
    let ChannelId: number | null = null;
    if (dto.channel) {
      // 지금 쓸 수 있는 채널인지 확인 (멤버가 아니면 404/403)
      const channel = await this.channelsService.getWorkspaceChannel(
        url,
        dto.channel,
        myId,
      );
      if (channel.archived) {
        throw new ForbiddenException('보관된 채널에는 쓸 수 없습니다.');
      }
      ChannelId = channel.id;
    } else {
      await this.workspacesService.assertMember(workspace.id, dto.receiverId);
    }
    const saved = await this.scheduledRepository.save({
      UserId: myId,
      WorkspaceId: workspace.id,
      ChannelId,
      ReceiverId: dto.receiverId || null,
      content: dto.content,
      sendAt,
    });
    this.eventsGateway.emitToUser(url, myId, 'scheduledChanged');
    return saved;
  }

  async cancelScheduled(url: string, id: number, myId: number) {
    await this.findWorkspace(url, myId);
    const result = await this.scheduledRepository.delete({ id, UserId: myId });
    if (!result.affected) {
      throw new NotFoundException('예약된 메시지가 없습니다.');
    }
    this.eventsGateway.emitToUser(url, myId, 'scheduledChanged');
  }

  // ── 리마인더
  async getReminders(url: string, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    return this.remindersRepository.find({
      where: { UserId: myId, WorkspaceId: workspace.id },
      relations: ['Chat', 'Chat.Channel', 'Chat.User', 'DM', 'DM.Sender'],
      order: { remindAt: 'ASC' },
    });
  }

  async createReminder(
    url: string,
    dto: { chatId?: number; dmId?: number; remindAt: string },
    myId: number,
  ) {
    const workspace = await this.findWorkspace(url, myId);
    if (!!dto.chatId === !!dto.dmId) {
      throw new BadRequestException('메시지를 하나 지정하세요.');
    }
    const remindAt = this.parseTime(dto.remindAt);
    if (dto.chatId) {
      const chat = await this.channelChatsRepository.findOne({
        where: { id: dto.chatId },
        relations: ['Channel'],
      });
      const isMember =
        chat?.Channel?.WorkspaceId === workspace.id &&
        (await this.channelMembersRepository.findOne({
          where: { ChannelId: chat.ChannelId, UserId: myId },
        }));
      if (!isMember) {
        throw new NotFoundException('존재하지 않는 메시지입니다.');
      }
    } else {
      const dm = await this.dmsRepository.findOne({
        where: { id: dto.dmId, WorkspaceId: workspace.id },
      });
      if (!dm || (dm.SenderId !== myId && dm.ReceiverId !== myId)) {
        throw new NotFoundException('존재하지 않는 메시지입니다.');
      }
    }
    const saved = await this.remindersRepository.save({
      UserId: myId,
      WorkspaceId: workspace.id,
      ChatId: dto.chatId || null,
      DMId: dto.dmId || null,
      remindAt,
    });
    this.eventsGateway.emitToUser(url, myId, 'scheduledChanged');
    return saved;
  }

  async cancelReminder(url: string, id: number, myId: number) {
    await this.findWorkspace(url, myId);
    const result = await this.remindersRepository.delete({ id, UserId: myId });
    if (!result.affected) {
      throw new NotFoundException('리마인더가 없습니다.');
    }
    this.eventsGateway.emitToUser(url, myId, 'scheduledChanged');
  }

  // ── 정한 시각이 된 예약 메시지를 보내고, 리마인더를 알린다
  async tick(now = new Date()) {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.sendDueMessages(now);
      await this.deliverDueReminders(now);
    } catch (error) {
      this.logger.error(error);
    } finally {
      this.running = false;
    }
  }

  private async sendDueMessages(now: Date) {
    const due = await this.scheduledRepository.find({
      where: { sendAt: LessThanOrEqual(now) },
      relations: ['Workspace', 'Channel'],
    });
    for (const item of due) {
      const url = item.Workspace.url;
      // 보내는 데 실패해도(채널을 나갔거나 보관됨 등) 다시 시도하지 않고 알린다
      await this.scheduledRepository.delete(item.id);
      try {
        if (item.ChannelId) {
          await this.channelsService.postChat(
            url,
            item.Channel.name,
            item.content,
            item.UserId,
          );
        } else {
          await this.dmsService.createWorkspaceDMChats(
            url,
            item.content,
            item.ReceiverId,
            item.UserId,
          );
        }
        this.eventsGateway.emitToUser(url, item.UserId, 'scheduledChanged');
      } catch (error) {
        this.eventsGateway.emitToUser(url, item.UserId, 'scheduledFailed', {
          content: item.content,
          reason: error?.message || '보내지 못했습니다.',
        });
      }
    }
  }

  private async deliverDueReminders(now: Date) {
    const due = await this.remindersRepository.find({
      where: { remindAt: LessThanOrEqual(now) },
      relations: [
        'Workspace',
        'Chat',
        'Chat.Channel',
        'Chat.User',
        'DM',
        'DM.Sender',
        'DM.Receiver',
      ],
    });
    for (const reminder of due) {
      const url = reminder.Workspace.url;
      // 접속해 있지 않으면 다음에 접속했을 때 알린다
      if (!this.eventsGateway.isOnline(url, reminder.UserId)) {
        continue;
      }
      await this.remindersRepository.delete(reminder.id);
      this.eventsGateway.emitToUser(url, reminder.UserId, 'reminder', {
        id: reminder.id,
        chat: reminder.Chat,
        dm: reminder.DM,
      });
      this.eventsGateway.emitToUser(url, reminder.UserId, 'scheduledChanged');
    }
  }
}
