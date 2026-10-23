import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelMembers } from '../entities/ChannelMembers';
import { SidebarSectionItems } from '../entities/SidebarSectionItems';
import { SidebarSections } from '../entities/SidebarSections';
import { EventsGateway } from '../events/events.gateway';
import { WorkspacesService } from '../workspaces/workspaces.service';

const MAX_SECTIONS = 20;

// 사이드바 섹션: 내가 만든 묶음에 채널·DM 을 넣는다 (나만 보이고, 내 모든 기기에 맞춘다)
@Injectable()
export class SectionsService {
  constructor(
    @InjectRepository(SidebarSections)
    private sectionsRepository: Repository<SidebarSections>,
    @InjectRepository(SidebarSectionItems)
    private itemsRepository: Repository<SidebarSectionItems>,
    @InjectRepository(ChannelMembers)
    private channelMembersRepository: Repository<ChannelMembers>,
    private workspacesService: WorkspacesService,
    private eventsGateway: EventsGateway,
  ) {}

  private async findWorkspace(url: string, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    const role = await this.workspacesService.assertMember(workspace.id, myId);
    return { workspace, role };
  }

  private changed(url: string, myId: number) {
    this.eventsGateway.emitToUser(url, myId, 'sidebarSectionsChanged');
  }

  private async mine(url: string, id: number, myId: number) {
    const { workspace } = await this.findWorkspace(url, myId);
    const section = await this.sectionsRepository.findOne({
      where: { id, UserId: myId, WorkspaceId: workspace.id },
    });
    if (!section) {
      throw new NotFoundException('존재하지 않는 섹션입니다.');
    }
    return { workspace, section };
  }

  async list(url: string, myId: number) {
    const { workspace } = await this.findWorkspace(url, myId);
    const sections = await this.sectionsRepository.find({
      where: { UserId: myId, WorkspaceId: workspace.id },
      relations: ['Items'],
      order: { position: 'ASC', id: 'ASC' },
    });
    return sections.map((s) => ({
      id: s.id,
      name: s.name,
      position: s.position,
      items: (s.Items || []).map((i) => ({ kind: i.kind, id: i.TargetId })),
    }));
  }

  async create(url: string, name: string, myId: number) {
    const { workspace } = await this.findWorkspace(url, myId);
    const count = await this.sectionsRepository.count({
      where: { UserId: myId, WorkspaceId: workspace.id },
    });
    if (count >= MAX_SECTIONS) {
      throw new BadRequestException(
        `섹션은 ${MAX_SECTIONS}개까지 만들 수 있습니다.`,
      );
    }
    const section = await this.sectionsRepository.save({
      UserId: myId,
      WorkspaceId: workspace.id,
      name: name.trim(),
      position: count,
    });
    this.changed(url, myId);
    return {
      id: section.id,
      name: section.name,
      position: section.position,
      items: [],
    };
  }

  async update(
    url: string,
    id: number,
    changes: { name?: string; position?: number },
    myId: number,
  ) {
    const { workspace, section } = await this.mine(url, id, myId);
    if (changes.name !== undefined) {
      await this.sectionsRepository.update(section.id, {
        name: changes.name.trim(),
      });
    }
    if (changes.position !== undefined) {
      // 순서를 바꾸면 내 섹션 전체를 다시 번호 매긴다
      const all = await this.sectionsRepository.find({
        where: { UserId: myId, WorkspaceId: workspace.id },
        order: { position: 'ASC', id: 'ASC' },
      });
      const rest = all.filter((s) => s.id !== section.id);
      const at = Math.min(changes.position, rest.length);
      rest.splice(at, 0, section);
      await Promise.all(
        rest.map((s, i) =>
          this.sectionsRepository.update(s.id, { position: i }),
        ),
      );
    }
    this.changed(url, myId);
  }

  async remove(url: string, id: number, myId: number) {
    const { section } = await this.mine(url, id, myId);
    // 안에 있던 채널·DM 은 원래 목록으로 돌아간다
    await this.itemsRepository.delete({ SectionId: section.id });
    await this.sectionsRepository.delete(section.id);
    this.changed(url, myId);
  }

  // 채널·DM 을 이 섹션으로 옮긴다 (다른 섹션에 있었으면 빼고)
  async putItem(
    url: string,
    id: number,
    kind: string,
    targetId: number,
    myId: number,
  ) {
    const { workspace, section } = await this.mine(url, id, myId);
    if (kind !== 'channel' && kind !== 'dm') {
      throw new BadRequestException('채널이나 DM 만 넣을 수 있습니다.');
    }
    if (kind === 'channel') {
      const member = await this.channelMembersRepository.findOne({
        where: { ChannelId: targetId, UserId: myId },
        relations: ['Channel'],
      });
      if (!member || member.Channel?.WorkspaceId !== workspace.id) {
        throw new NotFoundException('존재하지 않는 채널입니다.');
      }
    } else {
      await this.workspacesService.assertMember(workspace.id, targetId);
    }
    const where = {
      UserId: myId,
      WorkspaceId: workspace.id,
      kind: kind as 'channel' | 'dm',
      TargetId: targetId,
    };
    await this.itemsRepository.delete(where);
    await this.itemsRepository.save({ ...where, SectionId: section.id });
    this.changed(url, myId);
  }

  // 섹션에서 빼서 원래 목록으로
  async removeItem(url: string, kind: string, targetId: number, myId: number) {
    const { workspace } = await this.findWorkspace(url, myId);
    await this.itemsRepository.delete({
      UserId: myId,
      WorkspaceId: workspace.id,
      kind: kind as 'channel' | 'dm',
      TargetId: targetId,
    });
    this.changed(url, myId);
  }
}
