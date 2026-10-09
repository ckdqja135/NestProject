import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Not, Repository } from 'typeorm';
import { Channels } from '../entities/Channels';
import { ChannelMembers } from '../entities/ChannelMembers';
import { ChannelChats } from '../entities/ChannelChats';
import { Reactions } from '../entities/Reactions';
import { Users } from '../entities/Users';
import { WorkspaceMembers } from '../entities/WorkspaceMembers';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class ChannelsService {
  constructor(
    @InjectRepository(Channels)
    private channelsRepository: Repository<Channels>,
    @InjectRepository(ChannelMembers)
    private channelMembersRepository: Repository<ChannelMembers>,
    @InjectRepository(ChannelChats)
    private channelChatsRepository: Repository<ChannelChats>,
    @InjectRepository(Users)
    private usersRepository: Repository<Users>,
    @InjectRepository(WorkspaceMembers)
    private workspaceMembersRepository: Repository<WorkspaceMembers>,
    @InjectRepository(Reactions)
    private reactionsRepository: Repository<Reactions>,
    private workspacesService: WorkspacesService,
    private eventsGateway: EventsGateway,
  ) {}

  private async findChannel(url: string, name: string, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertMember(workspace.id, myId);
    const channel = await this.channelsRepository.findOne({
      where: { WorkspaceId: workspace.id, name },
    });
    if (!channel) {
      throw new NotFoundException('존재하지 않는 채널입니다.');
    }
    return channel;
  }

  async getWorkspaceChannels(url: string, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    return this.channelsRepository
      .createQueryBuilder('channels')
      .innerJoin(
        'channels.ChannelMembers',
        'channelMembers',
        'channelMembers.UserId = :myId',
        { myId },
      )
      .where('channels.WorkspaceId = :workspaceId', {
        workspaceId: workspace.id,
      })
      .orderBy('channels.id', 'ASC')
      .getMany();
  }

  async getWorkspaceChannel(url: string, name: string, myId: number) {
    return this.findChannel(url, name, myId);
  }

  async createWorkspaceChannel(url: string, name: string, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertMember(workspace.id, myId);
    const exists = await this.channelsRepository.findOne({
      where: { WorkspaceId: workspace.id, name },
    });
    if (exists) {
      throw new ForbiddenException('이미 존재하는 채널 이름입니다.');
    }
    const channel = await this.channelsRepository.save({
      name,
      WorkspaceId: workspace.id,
    });
    await this.channelMembersRepository.save({
      UserId: myId,
      ChannelId: channel.id,
    });
    return channel;
  }

  async getWorkspaceChannelMembers(url: string, name: string, myId: number) {
    const channel = await this.findChannel(url, name, myId);
    return this.usersRepository
      .createQueryBuilder('user')
      .innerJoin(
        'user.ChannelMembers',
        'members',
        'members.ChannelId = :channelId',
        { channelId: channel.id },
      )
      .orderBy('user.nickname', 'ASC')
      .getMany();
  }

  async createWorkspaceChannelMembers(
    url: string,
    name: string,
    email: string,
    myId: number,
  ) {
    const channel = await this.findChannel(url, name, myId);
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .innerJoin(
        'user.WorkspaceMembers',
        'members',
        'members.WorkspaceId = :workspaceId',
        { workspaceId: channel.WorkspaceId },
      )
      .where('user.email = :email', { email })
      .getOne();
    if (!user) {
      throw new NotFoundException('워크스페이스에 존재하지 않는 사용자입니다.');
    }
    const already = await this.channelMembersRepository.findOne({
      where: { ChannelId: channel.id, UserId: user.id },
    });
    if (already) {
      throw new ForbiddenException('이미 채널 멤버입니다.');
    }
    await this.channelMembersRepository.save({
      ChannelId: channel.id,
      UserId: user.id,
    });
  }

  // 채팅 목록/단건 조회 공통 쿼리 (작성자, 채널, 리액션, 답글 수 포함)
  private chatQuery() {
    return this.channelChatsRepository
      .createQueryBuilder('chats')
      .leftJoinAndSelect('chats.User', 'user')
      .leftJoinAndSelect('chats.Channel', 'channel')
      .leftJoinAndSelect('chats.Reactions', 'reactions')
      .loadRelationCountAndMap('chats.replyCount', 'chats.Replies');
  }

  private findChatWithRelations(id: number) {
    return this.chatQuery().where('chats.id = :id', { id }).getOne();
  }

  private async findChatInChannel(channel: Channels, chatId: number) {
    const chat = await this.channelChatsRepository.findOne({
      where: { id: chatId, ChannelId: channel.id },
    });
    if (!chat) {
      throw new NotFoundException('존재하지 않는 메시지입니다.');
    }
    return chat;
  }

  private emitToChannel(url: string, channelId: number, event: string, data) {
    this.eventsGateway.server.to(`/ws-${url}-${channelId}`).emit(event, data);
  }

  async getWorkspaceChannelChats(
    url: string,
    name: string,
    perPage: number,
    page: number,
    myId: number,
  ) {
    const channel = await this.findChannel(url, name, myId);
    // 스레드 답글은 채널 본문에 표시하지 않는다
    return this.chatQuery()
      .where('chats.ChannelId = :channelId', { channelId: channel.id })
      .andWhere('chats.ParentId IS NULL')
      .orderBy('chats.createdAt', 'DESC')
      .addOrderBy('chats.id', 'DESC')
      .take(perPage)
      .skip(perPage * (page - 1))
      .getMany();
  }

  async getChannelUnreadsCount(
    url: string,
    name: string,
    after: number,
    myId: number,
  ) {
    const channel = await this.findChannel(url, name, myId);
    // 내가 보낸 메시지와 스레드 답글은 안 읽은 메시지로 세지 않는다
    return this.channelChatsRepository.count({
      where: {
        ChannelId: channel.id,
        UserId: Not(myId),
        ParentId: IsNull(),
        createdAt: MoreThan(new Date(after)),
      },
    });
  }

  private async saveAndBroadcast(
    url: string,
    channel: Channels,
    content: string,
    myId: number,
    parentId: number | null = null,
  ) {
    const saved = await this.channelChatsRepository.save({
      content,
      UserId: myId,
      ChannelId: channel.id,
      ParentId: parentId,
    });
    const chatWithUser = await this.findChatWithRelations(saved.id);
    this.emitToChannel(url, channel.id, 'message', chatWithUser);
    return chatWithUser;
  }

  async postChat(url: string, name: string, content: string, myId: number) {
    const channel = await this.findChannel(url, name, myId);
    return this.saveAndBroadcast(url, channel, content, myId);
  }

  async createWorkspaceChannelImages(
    url: string,
    name: string,
    files: Express.Multer.File[],
    myId: number,
  ) {
    const channel = await this.findChannel(url, name, myId);
    for (const file of files) {
      await this.saveAndBroadcast(
        url,
        channel,
        file.path.replace(/\\/g, '/'),
        myId,
      );
    }
  }

  async editChat(
    url: string,
    name: string,
    chatId: number,
    content: string,
    myId: number,
  ) {
    const channel = await this.findChannel(url, name, myId);
    const chat = await this.findChatInChannel(channel, chatId);
    if (chat.UserId !== myId) {
      throw new ForbiddenException('내가 보낸 메시지만 수정할 수 있습니다.');
    }
    await this.channelChatsRepository.update(chat.id, {
      content,
      editedAt: new Date(),
    });
    const updated = await this.findChatWithRelations(chat.id);
    this.emitToChannel(url, channel.id, 'messageUpdated', updated);
    return updated;
  }

  async deleteChat(url: string, name: string, chatId: number, myId: number) {
    const channel = await this.findChannel(url, name, myId);
    const chat = await this.findChatInChannel(channel, chatId);
    if (chat.UserId !== myId) {
      throw new ForbiddenException('내가 보낸 메시지만 삭제할 수 있습니다.');
    }
    // 답글과 리액션은 FK ON DELETE CASCADE 로 함께 삭제된다
    await this.channelChatsRepository.delete(chat.id);
    this.emitToChannel(url, channel.id, 'messageDeleted', {
      id: chat.id,
      ChannelId: channel.id,
      ParentId: chat.ParentId,
    });
  }

  async getReplies(url: string, name: string, chatId: number, myId: number) {
    const channel = await this.findChannel(url, name, myId);
    const parent = await this.findChatInChannel(channel, chatId);
    return this.chatQuery()
      .where('chats.ParentId = :parentId', { parentId: parent.id })
      .orderBy('chats.createdAt', 'ASC')
      .addOrderBy('chats.id', 'ASC')
      .getMany();
  }

  async postReply(
    url: string,
    name: string,
    chatId: number,
    content: string,
    myId: number,
  ) {
    const channel = await this.findChannel(url, name, myId);
    const parent = await this.findChatInChannel(channel, chatId);
    if (parent.ParentId) {
      throw new BadRequestException('답글에는 다시 답글을 달 수 없습니다.');
    }
    return this.saveAndBroadcast(url, channel, content, myId, parent.id);
  }

  async toggleReaction(
    url: string,
    name: string,
    chatId: number,
    emoji: string,
    myId: number,
  ) {
    const channel = await this.findChannel(url, name, myId);
    const chat = await this.findChatInChannel(channel, chatId);
    const existing = await this.reactionsRepository.findOne({
      where: { ChatId: chat.id, UserId: myId, emoji },
    });
    if (existing) {
      await this.reactionsRepository.delete(existing.id);
    } else {
      await this.reactionsRepository.save({
        ChatId: chat.id,
        UserId: myId,
        emoji,
      });
    }
    const reactions = await this.reactionsRepository.find({
      where: { ChatId: chat.id },
      order: { id: 'ASC' },
    });
    const payload = {
      id: chat.id,
      ChannelId: channel.id,
      ParentId: chat.ParentId,
      Reactions: reactions,
    };
    this.emitToChannel(url, channel.id, 'reactionUpdated', payload);
    return payload;
  }

  async setPinned(
    url: string,
    name: string,
    chatId: number,
    pinned: boolean,
    myId: number,
  ) {
    const channel = await this.findChannel(url, name, myId);
    const chat = await this.findChatInChannel(channel, chatId);
    await this.channelChatsRepository.update(chat.id, { pinned });
    const updated = await this.findChatWithRelations(chat.id);
    this.emitToChannel(url, channel.id, 'messageUpdated', updated);
    return updated;
  }

  async getPinnedChats(url: string, name: string, myId: number) {
    const channel = await this.findChannel(url, name, myId);
    return this.chatQuery()
      .where('chats.ChannelId = :channelId', { channelId: channel.id })
      .andWhere('chats.pinned = :pinned', { pinned: true })
      .orderBy('chats.createdAt', 'DESC')
      .getMany();
  }

  async leaveChannel(url: string, name: string, myId: number) {
    const channel = await this.findChannel(url, name, myId);
    if (channel.name === '일반') {
      throw new BadRequestException('기본 채널(일반)은 나갈 수 없습니다.');
    }
    await this.channelMembersRepository.delete({
      ChannelId: channel.id,
      UserId: myId,
    });
  }
}
