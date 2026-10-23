import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { ChannelsService } from '../channels/channels.service';
import { Webhooks } from '../entities/Webhooks';
import {
  isAdminRole,
  WorkspacesService,
} from '../workspaces/workspaces.service';

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(Webhooks)
    private webhooksRepository: Repository<Webhooks>,
    private channelsService: ChannelsService,
    private workspacesService: WorkspacesService,
  ) {}

  // 채널 멤버만 그 채널의 웹훅을 보고 만들 수 있다
  async getWebhooks(url: string, name: string, myId: number) {
    const channel = await this.channelsService.getWorkspaceChannel(
      url,
      name,
      myId,
    );
    return this.webhooksRepository.find({
      where: { ChannelId: channel.id },
      order: { id: 'ASC' },
    });
  }

  async createWebhook(
    url: string,
    name: string,
    botName: string,
    myId: number,
  ) {
    const channel = await this.channelsService.getWorkspaceChannel(
      url,
      name,
      myId,
    );
    if (
      (await this.workspacesService.roleOf(channel.WorkspaceId, myId)) ===
      'guest'
    ) {
      throw new ForbiddenException('게스트는 웹훅을 만들 수 없습니다.');
    }
    return this.webhooksRepository.save({
      ChannelId: channel.id,
      name: botName.trim(),
      token: randomBytes(24).toString('hex'),
      CreatorId: myId,
    });
  }

  // 만든 사람이나 워크스페이스 관리자만 지울 수 있다
  async deleteWebhook(url: string, name: string, id: number, myId: number) {
    const channel = await this.channelsService.getWorkspaceChannel(
      url,
      name,
      myId,
    );
    const webhook = await this.webhooksRepository.findOne({
      where: { id, ChannelId: channel.id },
    });
    if (!webhook) {
      throw new NotFoundException('존재하지 않는 웹훅입니다.');
    }
    const role = await this.workspacesService.roleOf(channel.WorkspaceId, myId);
    if (webhook.CreatorId !== myId && !isAdminRole(role)) {
      throw new ForbiddenException(
        '웹훅을 만든 사람이나 워크스페이스 관리자만 지울 수 있습니다.',
      );
    }
    await this.webhooksRepository.delete(webhook.id);
  }

  // 외부에서 들어온 메시지 (토큰이 곧 권한)
  async receive(token: string, text: string, username?: string) {
    const webhook = await this.webhooksRepository.findOne({ where: { token } });
    if (!webhook) {
      throw new NotFoundException('존재하지 않는 웹훅입니다.');
    }
    const botName = (username?.trim() || webhook.name).slice(0, 40);
    const chat = await this.channelsService.postBotMessage(
      webhook.ChannelId,
      text,
      botName,
    );
    return { ok: true, id: chat.id };
  }
}
