import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocsService } from '../docs/docs.service';
import { ChannelMembers } from '../entities/ChannelMembers';
import { Channels } from '../entities/Channels';
import { ChannelTabs } from '../entities/ChannelTabs';
import { EventsGateway } from '../events/events.gateway';
import {
  isAdminRole,
  WorkspacesService,
} from '../workspaces/workspaces.service';
import { TabAccess } from './dto/channel-tabs.dto';

const MAX_TABS = 10;

// 채널 탭: 채널 위에 문서를 고정해 채팅과 작업물을 한 화면에서 오간다
@Injectable()
export class ChannelTabsService {
  constructor(
    @InjectRepository(ChannelTabs)
    private tabsRepository: Repository<ChannelTabs>,
    @InjectRepository(Channels)
    private channelsRepository: Repository<Channels>,
    @InjectRepository(ChannelMembers)
    private channelMembersRepository: Repository<ChannelMembers>,
    private workspacesService: WorkspacesService,
    private docsService: DocsService,
    private eventsGateway: EventsGateway,
  ) {}

  // 채널 멤버만 탭을 본다 (비공개 채널은 없는 것처럼). write 면 보관된 채널은 막는다
  private async channelFor(
    url: string,
    name: string,
    myId: number,
    write = false,
  ) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    const role = await this.workspacesService.assertMember(workspace.id, myId);
    const channel = await this.channelsRepository.findOne({
      where: { WorkspaceId: workspace.id, name },
    });
    if (!channel) {
      throw new NotFoundException('존재하지 않는 채널입니다.');
    }
    const member = await this.channelMembersRepository.findOne({
      where: { ChannelId: channel.id, UserId: myId },
    });
    if (!member) {
      if (channel.private) {
        throw new NotFoundException('존재하지 않는 채널입니다.');
      }
      throw new ForbiddenException('채널에 참여한 뒤 이용할 수 있습니다.');
    }
    if (write && channel.archived) {
      throw new ForbiddenException('보관된 채널은 바꿀 수 없습니다.');
    }
    return { workspace, channel, role };
  }

  private changed(url: string, channelId: number) {
    this.eventsGateway.emitToWorkspace(url, 'channelTabsChanged', {
      channelId,
    });
  }

  // 탭 목록: 볼 수 없는 문서는 제목을 숨긴다 (휴지통 문서는 빼고)
  async list(url: string, name: string, myId: number) {
    const { channel } = await this.channelFor(url, name, myId);
    const tabs = await this.tabsRepository.find({
      where: { ChannelId: channel.id },
      order: { position: 'ASC', id: 'ASC' },
    });
    const result = [];
    for (const tab of tabs) {
      const access = await this.docsService.accessOf(url, tab.DocId, myId);
      if (access?.doc.deletedAt) continue;
      result.push({
        id: tab.id,
        docId: tab.DocId,
        access: tab.access,
        notify: tab.notify,
        creatorId: tab.CreatorId,
        canView: !!access,
        canManage: !!access?.canManage,
        title: access?.doc.title ?? null,
        type: access?.doc.type ?? null,
      });
    }
    return result;
  }

  async add(
    url: string,
    name: string,
    dto: {
      docId?: number;
      newType?: string;
      newTitle?: string;
      access?: TabAccess;
    },
    myId: number,
  ) {
    const { channel, role } = await this.channelFor(url, name, myId, true);
    if (role === 'guest') {
      throw new ForbiddenException('게스트는 채널 탭을 만들 수 없습니다.');
    }
    if (!dto.docId === !dto.newType) {
      throw new BadRequestException(
        '문서를 고르거나 새로 만들 종류를 정하세요.',
      );
    }
    const count = await this.tabsRepository.count({
      where: { ChannelId: channel.id },
    });
    if (count >= MAX_TABS) {
      throw new BadRequestException(
        `탭은 채널마다 ${MAX_TABS}개까지 둘 수 있습니다.`,
      );
    }
    let docId = dto.docId;
    let access: TabAccess = dto.access || 'none';
    if (dto.newType) {
      // 채널에서 새로 만든 문서는 채널 멤버 모두가 함께 고치는 문서로 시작한다
      const doc = await this.docsService.createDoc(
        url,
        {
          type: dto.newType as any,
          title: dto.newTitle,
          visibility: 'private',
        },
        myId,
      );
      docId = doc.id;
      access = dto.access || 'edit';
    }
    const mine = await this.docsService.accessOf(url, docId!, myId);
    if (!mine) {
      throw new NotFoundException('존재하지 않는 문서입니다.');
    }
    if (access !== 'none' && !mine.canManage) {
      throw new ForbiddenException(
        '채널 멤버에게 권한을 주려면 문서를 만든 사람이나 관리자여야 합니다.',
      );
    }
    const exists = await this.tabsRepository.findOne({
      where: { ChannelId: channel.id, DocId: docId },
    });
    if (exists) {
      throw new BadRequestException('이미 이 채널의 탭에 있는 문서입니다.');
    }
    const last = await this.tabsRepository.findOne({
      where: { ChannelId: channel.id },
      order: { position: 'DESC' },
    });
    const tab = await this.tabsRepository.save({
      ChannelId: channel.id,
      DocId: docId!,
      access,
      position: (last?.position ?? -1) + 1,
      CreatorId: myId,
    });
    this.changed(url, channel.id);
    if (access !== 'none') {
      this.grantChanged(url, docId!);
    }
    return { id: tab.id, docId: tab.DocId, access: tab.access };
  }

  private grantChanged(url: string, docId: number) {
    this.eventsGateway.emitToWorkspace(url, 'docsChanged', { id: docId });
    this.eventsGateway.docAccessChanged(url, docId);
  }

  private async findTab(channelId: number, tabId: number) {
    const tab = await this.tabsRepository.findOne({
      where: { id: tabId, ChannelId: channelId },
    });
    if (!tab) {
      throw new NotFoundException('존재하지 않는 탭입니다.');
    }
    return tab;
  }

  // 채널 멤버에게 준 권한(문서를 관리하는 사람만)이나 채널 알림(탭을 뺄 수 있는 사람) 바꾸기
  async update(
    url: string,
    name: string,
    tabId: number,
    dto: { access?: TabAccess; notify?: boolean },
    myId: number,
  ) {
    const { channel, role } = await this.channelFor(url, name, myId, true);
    const tab = await this.findTab(channel.id, tabId);
    const mine = await this.docsService.accessOf(url, tab.DocId, myId);
    if (dto.access !== undefined && dto.access !== tab.access) {
      if (!mine?.canManage) {
        throw new ForbiddenException(
          '문서를 만든 사람이나 관리자만 바꿀 수 있습니다.',
        );
      }
      await this.tabsRepository.update(tab.id, { access: dto.access });
      this.grantChanged(url, tab.DocId);
    }
    if (dto.notify !== undefined && dto.notify !== tab.notify) {
      if (!this.canArrange(tab, channel, role, !!mine?.canManage, myId)) {
        throw new ForbiddenException(
          '탭을 만든 사람, 채널을 만든 사람이나 관리자만 바꿀 수 있습니다.',
        );
      }
      await this.tabsRepository.update(tab.id, { notify: dto.notify });
    }
    this.changed(url, channel.id);
    return {
      id: tab.id,
      access: dto.access ?? tab.access,
      notify: dto.notify ?? tab.notify,
    };
  }

  private canArrange(
    tab: ChannelTabs,
    channel: Channels,
    role: string,
    canManageDoc: boolean,
    myId: number,
  ) {
    return (
      tab.CreatorId === myId ||
      channel.OwnerId === myId ||
      isAdminRole(role as any) ||
      canManageDoc
    );
  }

  // 탭 빼기: 탭을 만든 사람, 문서를 관리하는 사람, 채널을 만든 사람, 관리자
  async remove(url: string, name: string, tabId: number, myId: number) {
    const { channel, role } = await this.channelFor(url, name, myId, true);
    const tab = await this.findTab(channel.id, tabId);
    const mine = await this.docsService.accessOf(url, tab.DocId, myId);
    if (!this.canArrange(tab, channel, role, !!mine?.canManage, myId)) {
      throw new ForbiddenException(
        '탭을 만든 사람, 채널을 만든 사람이나 관리자만 뺄 수 있습니다.',
      );
    }
    await this.tabsRepository.delete(tab.id);
    this.changed(url, channel.id);
    if (tab.access !== 'none') {
      this.grantChanged(url, tab.DocId);
    }
  }

  async reorder(url: string, name: string, ids: number[], myId: number) {
    const { channel } = await this.channelFor(url, name, myId, true);
    const tabs = await this.tabsRepository.find({
      where: { ChannelId: channel.id },
    });
    const known = new Set(tabs.map((t) => t.id));
    const order = ids.filter((id) => known.has(id));
    for (const [position, id] of order.entries()) {
      await this.tabsRepository.update(id, { position });
    }
    this.changed(url, channel.id);
  }
}
