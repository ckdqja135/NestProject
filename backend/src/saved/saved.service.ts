import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelChats } from '../entities/ChannelChats';
import { ChannelMembers } from '../entities/ChannelMembers';
import { DMs } from '../entities/DMs';
import { SavedItems } from '../entities/SavedItems';
import { EventsGateway } from '../events/events.gateway';
import { WorkspacesService } from '../workspaces/workspaces.service';

const LIST_LIMIT = 100;

export type SavedTarget = { chatId: number } | { dmId: number };

@Injectable()
export class SavedService {
  constructor(
    @InjectRepository(SavedItems)
    private savedRepository: Repository<SavedItems>,
    @InjectRepository(ChannelChats)
    private channelChatsRepository: Repository<ChannelChats>,
    @InjectRepository(ChannelMembers)
    private channelMembersRepository: Repository<ChannelMembers>,
    @InjectRepository(DMs)
    private dmsRepository: Repository<DMs>,
    private workspacesService: WorkspacesService,
    private eventsGateway: EventsGateway,
  ) {}

  private async findWorkspace(url: string, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertMember(workspace.id, myId);
    return workspace;
  }

  // 내가 저장한 메시지 (최신순). 나간 채널의 메시지는 보이지 않는다.
  async getSaved(url: string, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    return this.savedRepository
      .createQueryBuilder('saved')
      .leftJoinAndSelect('saved.Chat', 'chat')
      .leftJoinAndSelect('chat.User', 'chatUser')
      .leftJoinAndSelect('chat.Channel', 'channel')
      .leftJoin('channel.ChannelMembers', 'member', 'member.UserId = :myId', {
        myId,
      })
      .leftJoinAndSelect('saved.DM', 'dm')
      .leftJoinAndSelect('dm.Sender', 'sender')
      .leftJoinAndSelect('dm.Receiver', 'receiver')
      .where('saved.UserId = :myId', { myId })
      .andWhere('saved.WorkspaceId = :workspaceId', {
        workspaceId: workspace.id,
      })
      .andWhere('(saved.DMId IS NOT NULL OR member.UserId IS NOT NULL)')
      .orderBy('saved.id', 'DESC')
      .limit(LIST_LIMIT)
      .getMany();
  }

  // 저장할 수 있는(내가 볼 수 있는) 메시지인지 확인
  private async assertVisible(
    workspaceId: number,
    target: SavedTarget,
    myId: number,
  ) {
    if ('chatId' in target) {
      const chat = await this.channelChatsRepository.findOne({
        where: { id: target.chatId },
        relations: ['Channel'],
      });
      const isMember =
        chat?.Channel?.WorkspaceId === workspaceId &&
        (await this.channelMembersRepository.findOne({
          where: { ChannelId: chat.ChannelId, UserId: myId },
        }));
      if (!isMember) {
        throw new NotFoundException('존재하지 않는 메시지입니다.');
      }
      return;
    }
    const dm = await this.dmsRepository.findOne({
      where: { id: target.dmId, WorkspaceId: workspaceId },
    });
    if (!dm || (dm.SenderId !== myId && dm.ReceiverId !== myId)) {
      throw new NotFoundException('존재하지 않는 메시지입니다.');
    }
  }

  private whereOf(target: SavedTarget, myId: number) {
    return 'chatId' in target
      ? { UserId: myId, ChatId: target.chatId }
      : { UserId: myId, DMId: target.dmId };
  }

  async save(url: string, target: SavedTarget, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    await this.assertVisible(workspace.id, target, myId);
    const where = this.whereOf(target, myId);
    if (!(await this.savedRepository.findOne({ where }))) {
      await this.savedRepository.save({ ...where, WorkspaceId: workspace.id });
    }
    this.eventsGateway.emitToUser(url, myId, 'savedChanged');
  }

  async remove(url: string, target: SavedTarget, myId: number) {
    await this.findWorkspace(url, myId);
    await this.savedRepository.delete(this.whereOf(target, myId));
    this.eventsGateway.emitToUser(url, myId, 'savedChanged');
  }
}
