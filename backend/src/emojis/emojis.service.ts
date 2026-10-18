import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomEmojis } from '../entities/CustomEmojis';
import { EventsGateway } from '../events/events.gateway';
import { WorkspacesService } from '../workspaces/workspaces.service';

@Injectable()
export class EmojisService {
  constructor(
    @InjectRepository(CustomEmojis)
    private emojisRepository: Repository<CustomEmojis>,
    private workspacesService: WorkspacesService,
    private eventsGateway: EventsGateway,
  ) {}

  private async findWorkspace(url: string, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertMember(workspace.id, myId);
    return workspace;
  }

  async getEmojis(url: string, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    return this.emojisRepository.find({
      where: { WorkspaceId: workspace.id },
      order: { name: 'ASC' },
    });
  }

  async createEmoji(url: string, name: string, image: string, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    const exists = await this.emojisRepository.findOne({
      where: { WorkspaceId: workspace.id, name },
    });
    if (exists) {
      throw new ForbiddenException('이미 있는 이모지 이름입니다.');
    }
    const emoji = await this.emojisRepository.save({
      WorkspaceId: workspace.id,
      name,
      image,
      CreatorId: myId,
    });
    this.eventsGateway.emitToWorkspace(url, 'emojisChanged');
    return emoji;
  }

  // 올린 사람이나 워크스페이스 소유자만 지울 수 있다
  async deleteEmoji(url: string, id: number, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    const emoji = await this.emojisRepository.findOne({
      where: { id, WorkspaceId: workspace.id },
    });
    if (!emoji) {
      throw new NotFoundException('존재하지 않는 이모지입니다.');
    }
    if (emoji.CreatorId !== myId && workspace.OwnerId !== myId) {
      throw new ForbiddenException(
        '이모지를 올린 사람이나 워크스페이스 소유자만 지울 수 있습니다.',
      );
    }
    await this.emojisRepository.delete(emoji.id);
    this.eventsGateway.emitToWorkspace(url, 'emojisChanged');
  }
}
