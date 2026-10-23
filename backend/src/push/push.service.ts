import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webpush from 'web-push';
import { isQuietNow, parseDnd } from '../common/dnd';
import { previewText } from '../common/preview';
import { AppSettings } from '../entities/AppSettings';
import { ChannelChats } from '../entities/ChannelChats';
import { PushSubscriptions } from '../entities/PushSubscriptions';
import { Users } from '../entities/Users';
import { onlineMap } from '../events/onlineMap';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

// 브라우저 회사의 푸시 서버만 받는다 (아무 주소로나 요청을 보내지 않게)
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /\.push\.services\.mozilla\.com$/,
  /\.notify\.windows\.com$/,
  /^web\.push\.apple\.com$/,
  /\.push\.apple\.com$/,
];

export const isAllowedEndpoint = (endpoint: string, production: boolean) => {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (
    url.protocol === 'https:' &&
    PUSH_HOSTS.some((re) => re.test(url.hostname))
  ) {
    return true;
  }
  // 개발 중에는 이 컴퓨터의 가짜 푸시 서버로 시험할 수 있게
  return (
    !production &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  );
};

// 탭을 모두 닫아도 멘션·DM 을 알리는 브라우저 푸시 (Web Push).
// 서명 키(VAPID)는 .env 에 없으면 처음 켤 때 만들어 DB 에 둔다.
@Injectable()
export class PushService implements OnModuleInit {
  private logger = new Logger('Push');
  private publicKey = '';

  constructor(
    @InjectRepository(PushSubscriptions)
    private subscriptionsRepository: Repository<PushSubscriptions>,
    @InjectRepository(AppSettings)
    private settingsRepository: Repository<AppSettings>,
    @InjectRepository(Users)
    private usersRepository: Repository<Users>,
  ) {}

  async onModuleInit() {
    let publicKey = process.env.VAPID_PUBLIC_KEY;
    let privateKey = process.env.VAPID_PRIVATE_KEY;
    try {
      if (!publicKey || !privateKey) {
        const stored = await this.settingsRepository.findOne({
          where: { key: 'vapid' },
        });
        if (stored) {
          ({ publicKey, privateKey } = JSON.parse(stored.value));
        } else {
          const keys = webpush.generateVAPIDKeys();
          await this.settingsRepository.save({
            key: 'vapid',
            value: JSON.stringify(keys),
          });
          ({ publicKey, privateKey } = keys);
        }
      }
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@shlack.local',
        publicKey as string,
        privateKey as string,
      );
      this.publicKey = publicKey as string;
    } catch (error) {
      // 마이그레이션 전이라 표가 없으면 푸시만 꺼진 채로 켠다
      this.logger.warn(`푸시 알림을 켜지 못했습니다: ${error}`);
    }
  }

  getPublicKey() {
    return { publicKey: this.publicKey || null };
  }

  async subscribe(
    userId: number,
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    if (
      !isAllowedEndpoint(sub.endpoint, process.env.NODE_ENV === 'production')
    ) {
      throw new BadRequestException('지원하지 않는 푸시 주소입니다.');
    }
    const existing = await this.subscriptionsRepository.findOne({
      where: { endpoint: sub.endpoint },
    });
    if (existing) {
      await this.subscriptionsRepository.update(existing.id, {
        UserId: userId,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      });
    } else {
      await this.subscriptionsRepository.save({
        UserId: userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      });
    }
  }

  async unsubscribe(userId: number, endpoint: string) {
    await this.subscriptionsRepository.delete({ UserId: userId, endpoint });
  }

  private isOnline(userId: number) {
    return Object.values(onlineMap).some((sockets) =>
      Object.values(sockets).includes(userId),
    );
  }

  // 접속해 있지 않고, 알림을 끄지 않았고, 방해 금지 시간이 아닐 때만 보낸다
  async notify(userId: number, payload: PushPayload) {
    if (!this.publicKey || this.isOnline(userId)) return;
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'bot', 'notificationsPaused', 'dndSchedule'],
    });
    if (
      !user ||
      user.bot ||
      user.notificationsPaused ||
      isQuietNow(parseDnd(user.dndSchedule))
    ) {
      return;
    }
    const subscriptions = await this.subscriptionsRepository.find({
      where: { UserId: userId },
    });
    await Promise.all(
      subscriptions.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
            { TTL: 60 * 60 },
          );
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          // 브라우저가 구독을 끊었으면 지운다
          if (status === 404 || status === 410) {
            await this.subscriptionsRepository.delete(s.id);
          } else {
            this.logger.warn(`푸시를 보내지 못했습니다 (${status || error})`);
          }
        }
      }),
    );
  }

  // 채널 메시지 멘션
  async notifyMention(url: string, chat: ChannelChats, userIds: number[]) {
    if (!this.publicKey || !userIds.length) return;
    const row = await this.usersRepository.manager.query(
      `SELECT c.name AS channel, u.nickname AS sender
         FROM channels c LEFT JOIN users u ON u.id = ?
        WHERE c.id = ?`,
      [chat.UserId, chat.ChannelId],
    );
    const channel = row[0]?.channel || '';
    const sender = row[0]?.sender || chat.botName || '앱';
    const query = chat.ParentId
      ? `message=${chat.ParentId}&reply=${chat.id}`
      : `message=${chat.id}`;
    await Promise.all(
      userIds.map((id) =>
        this.notify(id, {
          title: `${sender} · #${channel}`,
          body: previewText(chat.content),
          url: `/workspace/${url}/channel/${encodeURIComponent(
            channel,
          )}?${query}`,
          tag: `chat-${chat.id}`,
        }),
      ),
    );
  }
}
