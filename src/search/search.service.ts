import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelChats } from '../entities/ChannelChats';
import { DMs } from '../entities/DMs';
import { WorkspacesService } from '../workspaces/workspaces.service';

const SEARCH_LIMIT = 30;

// LIKE 패턴에서 와일드카드로 해석되는 문자를 이스케이프
export function escapeLike(keyword: string) {
  return keyword.replace(/[\\%_]/g, (c) => `\\${c}`);
}

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(ChannelChats)
    private channelChatsRepository: Repository<ChannelChats>,
    @InjectRepository(DMs) private dmsRepository: Repository<DMs>,
    private workspacesService: WorkspacesService,
  ) {}

  async search(url: string, keyword: string, myId: number) {
    const q = (keyword || '').trim();
    if (!q) {
      throw new BadRequestException('검색어를 입력해주세요.');
    }
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertMember(workspace.id, myId);
    const like = `%${escapeLike(q)}%`;

    // 내가 참여한 채널의 메시지만 검색
    const chats = await this.channelChatsRepository
      .createQueryBuilder('chats')
      .innerJoinAndSelect('chats.User', 'user')
      .innerJoinAndSelect('chats.Channel', 'channel')
      .innerJoin(
        'channel.ChannelMembers',
        'members',
        'members.UserId = :myId',
        { myId },
      )
      .where('channel.WorkspaceId = :workspaceId', {
        workspaceId: workspace.id,
      })
      .andWhere('chats.content LIKE :like', { like })
      .orderBy('chats.createdAt', 'DESC')
      .take(SEARCH_LIMIT)
      .getMany();

    // 내가 보내거나 받은 DM만 검색
    const dms = await this.dmsRepository
      .createQueryBuilder('dms')
      .innerJoinAndSelect('dms.Sender', 'sender')
      .innerJoinAndSelect('dms.Receiver', 'receiver')
      .where('dms.WorkspaceId = :workspaceId', { workspaceId: workspace.id })
      .andWhere('(dms.SenderId = :myId OR dms.ReceiverId = :myId)', { myId })
      .andWhere('dms.content LIKE :like', { like })
      .orderBy('dms.createdAt', 'DESC')
      .take(SEARCH_LIMIT)
      .getMany();

    return { chats, dms };
  }
}
