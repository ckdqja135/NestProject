import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { In, Not, IsNull, Repository } from 'typeorm';
import { Apps } from '../entities/Apps';
import { ChannelMembers } from '../entities/ChannelMembers';
import { postToApp } from './app-http';

export const APP_EVENTS = ['message', 'app_mention', 'reaction_added'] as const;
export type AppEventType = (typeof APP_EVENTS)[number];

// 다시 보내는 간격 (앱이 꺼져 있거나 5xx 면)
const RETRY_DELAYS_MS = [2000, 10_000];
const CACHE_MS = 30_000;

interface EventApp {
  id: number;
  BotUserId: number;
  eventUrl: string;
  events: AppEventType[];
  signingSecret: string;
}

interface EventUser {
  id: number;
  nickname?: string;
}

const mentions = (content: string, userId: number) =>
  new RegExp(`@\\[[^\\]]*\\]\\(${userId}\\)`).test(content);

// 채팅에서 일어난 일을 앱의 이벤트 주소로 보낸다 (앱 봇이 들어간 채널, 앱 봇에게 온 DM)
@Injectable()
export class AppEventsService {
  private logger = new Logger('AppEvents');
  // 워크스페이스별 이벤트를 받는 앱 (메시지마다 DB 를 읽지 않게 잠깐 기억한다)
  private cache = new Map<number, { at: number; apps: EventApp[] }>();

  constructor(
    @InjectRepository(Apps) private appsRepository: Repository<Apps>,
    @InjectRepository(ChannelMembers)
    private channelMembersRepository: Repository<ChannelMembers>,
  ) {}

  // 앱 설정이 바뀌면 다시 읽는다
  invalidate(workspaceId: number) {
    this.cache.delete(workspaceId);
  }

  private async appsOf(workspaceId: number) {
    const cached = this.cache.get(workspaceId);
    if (cached && Date.now() - cached.at < CACHE_MS) {
      return cached.apps;
    }
    const rows = await this.appsRepository.find({
      where: { WorkspaceId: workspaceId, eventUrl: Not(IsNull()) },
      select: ['id', 'BotUserId', 'eventUrl', 'events', 'signingSecret'],
    });
    const apps = rows
      .filter((a) => a.eventUrl && a.events)
      .map((a) => ({
        id: a.id,
        BotUserId: a.BotUserId,
        eventUrl: a.eventUrl!,
        signingSecret: a.signingSecret,
        events: a.events
          .split(',')
          .filter((e): e is AppEventType => APP_EVENTS.includes(e as any)),
      }));
    this.cache.set(workspaceId, { at: Date.now(), apps });
    return apps;
  }

  async isAppBot(workspaceId: number, userId: number) {
    const count = await this.appsRepository.count({
      where: { WorkspaceId: workspaceId, BotUserId: userId },
    });
    return count > 0;
  }

  // 채널에 앱 봇이 들어가 있는 앱들
  private async appsInChannel(workspaceId: number, channelId: number) {
    const apps = await this.appsOf(workspaceId);
    if (!apps.length) return [];
    const members = await this.channelMembersRepository.find({
      where: { ChannelId: channelId, UserId: In(apps.map((a) => a.BotUserId)) },
      select: ['UserId'],
    });
    const inChannel = new Set(members.map((m) => m.UserId));
    return apps.filter((a) => inChannel.has(a.BotUserId));
  }

  // 채널에 새 메시지 (스레드 답글 포함)
  async channelMessage(
    url: string,
    channel: { id: number; name: string; WorkspaceId: number },
    chat: {
      id: number;
      content: string;
      ParentId?: number | null;
      createdAt?: Date;
      User?: EventUser | null;
      UserId?: number | null;
    },
  ) {
    try {
      const apps = await this.appsInChannel(channel.WorkspaceId, channel.id);
      for (const app of apps) {
        // 앱이 쓴 메시지는 앱에게 다시 보내지 않는다 (무한 반복 방지)
        if (chat.UserId === app.BotUserId) continue;
        const event = {
          channel: channel.name,
          channel_type: 'channel',
          user: chat.User
            ? { id: chat.User.id, nickname: chat.User.nickname }
            : null,
          text: chat.content,
          message_id: chat.id,
          thread_id: chat.ParentId || null,
          created_at: chat.createdAt || new Date(),
        };
        if (app.events.includes('message')) {
          this.deliver(url, app, { type: 'message', ...event });
        }
        if (
          app.events.includes('app_mention') &&
          mentions(chat.content, app.BotUserId)
        ) {
          this.deliver(url, app, { type: 'app_mention', ...event });
        }
      }
    } catch (error) {
      this.logger.warn(
        `앱 이벤트를 만들지 못했습니다: ${(error as Error).message}`,
      );
    }
  }

  // 앱 봇에게 온 DM
  async directMessage(
    url: string,
    workspaceId: number,
    dm: {
      id: number;
      content: string;
      SenderId: number;
      ReceiverId: number;
      createdAt?: Date;
      Sender?: EventUser | null;
    },
  ) {
    try {
      const apps = await this.appsOf(workspaceId);
      const app = apps.find((a) => a.BotUserId === dm.ReceiverId);
      if (!app || dm.SenderId === app.BotUserId) return;
      if (!app.events.includes('message')) return;
      this.deliver(url, app, {
        type: 'message',
        channel: null,
        channel_type: 'im',
        user: { id: dm.SenderId, nickname: dm.Sender?.nickname },
        text: dm.content,
        message_id: dm.id,
        thread_id: null,
        created_at: dm.createdAt || new Date(),
      });
    } catch (error) {
      this.logger.warn(
        `앱 이벤트를 만들지 못했습니다: ${(error as Error).message}`,
      );
    }
  }

  // 채널 메시지에 리액션이 붙었다
  async reactionAdded(
    url: string,
    channel: { id: number; name: string; WorkspaceId: number },
    chatId: number,
    userId: number,
    emoji: string,
  ) {
    try {
      const apps = await this.appsInChannel(channel.WorkspaceId, channel.id);
      for (const app of apps) {
        if (
          userId === app.BotUserId ||
          !app.events.includes('reaction_added')
        ) {
          continue;
        }
        this.deliver(url, app, {
          type: 'reaction_added',
          channel: channel.name,
          channel_type: 'channel',
          user: { id: userId },
          emoji,
          message_id: chatId,
        });
      }
    } catch (error) {
      this.logger.warn(
        `앱 이벤트를 만들지 못했습니다: ${(error as Error).message}`,
      );
    }
  }

  // 보내기는 기다리지 않는다 (채팅이 느려지지 않게). 실패하면 몇 번 다시 보내고 결과를 남긴다
  private deliver(url: string, app: EventApp, event: Record<string, unknown>) {
    const payload = {
      type: 'event_callback',
      event_id: `ev_${randomBytes(8).toString('hex')}`,
      event_time: Math.floor(Date.now() / 1000),
      app_id: app.id,
      workspace: url,
      event,
    };
    const attempt = (index: number) => {
      postToApp(app.eventUrl, payload, app.signingSecret)
        .then(async (response) => {
          if (response.status >= 500 && index < RETRY_DELAYS_MS.length) {
            setTimeout(() => attempt(index + 1), RETRY_DELAYS_MS[index]);
            return;
          }
          const ok = response.status >= 200 && response.status < 300;
          await this.record(app.id, ok ? null : `HTTP ${response.status}`);
        })
        .catch(async (error: Error) => {
          if (index < RETRY_DELAYS_MS.length) {
            setTimeout(() => attempt(index + 1), RETRY_DELAYS_MS[index]);
            return;
          }
          await this.record(app.id, error.message);
        });
    };
    attempt(0);
  }

  private async record(appId: number, error: string | null) {
    await this.appsRepository
      .update(appId, {
        lastEventAt: new Date(),
        lastEventError: error ? error.slice(0, 200) : null,
      })
      .catch(() => undefined);
  }
}
