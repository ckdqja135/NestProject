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
import { MentionsService } from '../mentions/mentions.service';
import { toFileContent, toFileMeta } from '../common/upload';

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
    private mentionsService: MentionsService,
  ) {}

  // 채널 멤버만 채널을 다룰 수 있다. 비공개 채널은 존재 여부도 숨기도록 404 로 응답한다.
  private async findChannel(url: string, name: string, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertMember(workspace.id, myId);
    const channel = await this.channelsRepository.findOne({
      where: { WorkspaceId: workspace.id, name },
    });
    if (!channel) {
      throw new NotFoundException('존재하지 않는 채널입니다.');
    }
    const isMember = await this.channelMembersRepository.findOne({
      where: { ChannelId: channel.id, UserId: myId },
    });
    if (!isMember) {
      if (channel.private) {
        throw new NotFoundException('존재하지 않는 채널입니다.');
      }
      throw new ForbiddenException('채널에 참여한 뒤 이용할 수 있습니다.');
    }
    return channel;
  }

  // 보관된 채널은 읽기만 할 수 있다
  private async findWritableChannel(url: string, name: string, myId: number) {
    const channel = await this.findChannel(url, name, myId);
    if (channel.archived) {
      throw new ForbiddenException('보관된 채널에는 쓸 수 없습니다.');
    }
    return channel;
  }

  // 채널 이름 변경/보관/삭제는 채널을 만든 사람과 워크스페이스 소유자만 할 수 있다
  private async findManageableChannel(url: string, name: string, myId: number) {
    const channel = await this.findChannel(url, name, myId);
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    if (channel.OwnerId !== myId && workspace.OwnerId !== myId) {
      throw new ForbiddenException(
        '채널을 만든 사람이나 워크스페이스 소유자만 할 수 있습니다.',
      );
    }
    if (channel.name === '일반') {
      throw new BadRequestException(
        '기본 채널(일반)은 이름을 바꾸거나 보관/삭제할 수 없습니다.',
      );
    }
    return channel;
  }

  private assertChannelName(name: string) {
    if (name === 'browse') {
      // GET channels/browse(채널 둘러보기) 경로와 겹치므로 사용할 수 없다
      throw new BadRequestException('사용할 수 없는 채널 이름입니다.');
    }
  }

  // 내가 참여 중인 채널 목록 (내 알림 끄기 여부 muted 포함)
  async getWorkspaceChannels(url: string, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    const channels = await this.channelsRepository
      .createQueryBuilder('channels')
      .innerJoinAndSelect(
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
    return channels.map(({ ChannelMembers, ...channel }) => ({
      ...channel,
      muted: !!ChannelMembers?.[0]?.muted,
    }));
  }

  async getWorkspaceChannel(url: string, name: string, myId: number) {
    return this.findChannel(url, name, myId);
  }

  async createWorkspaceChannel(
    url: string,
    name: string,
    isPrivate: boolean,
    myId: number,
  ) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertMember(workspace.id, myId);
    this.assertChannelName(name);
    const exists = await this.channelsRepository.findOne({
      where: { WorkspaceId: workspace.id, name },
    });
    if (exists) {
      throw new ForbiddenException('이미 존재하는 채널 이름입니다.');
    }
    const channel = await this.channelsRepository.save({
      name,
      WorkspaceId: workspace.id,
      private: isPrivate,
      OwnerId: myId,
    });
    await this.channelMembersRepository.save({
      UserId: myId,
      ChannelId: channel.id,
    });
    return channel;
  }

  // 채널 둘러보기: 워크스페이스의 공개 채널 목록 (참여 여부, 멤버 수 포함)
  async browsePublicChannels(url: string, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertMember(workspace.id, myId);
    const channels = await this.channelsRepository
      .createQueryBuilder('channels')
      .loadRelationCountAndMap(
        'channels.memberCount',
        'channels.ChannelMembers',
      )
      .where('channels.WorkspaceId = :workspaceId', {
        workspaceId: workspace.id,
      })
      .andWhere('channels.private = :private', { private: false })
      .orderBy('channels.name', 'ASC')
      .getMany();
    const joined = await this.channelMembersRepository.find({
      where: { UserId: myId },
      select: ['ChannelId'],
    });
    const joinedIds = new Set(joined.map((m) => m.ChannelId));
    return channels.map((channel) => ({
      ...channel,
      joined: joinedIds.has(channel.id),
    }));
  }

  // 공개 채널에 스스로 참여. 비공개 채널은 초대로만 들어올 수 있다.
  async joinChannel(url: string, name: string, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertMember(workspace.id, myId);
    const channel = await this.channelsRepository.findOne({
      where: { WorkspaceId: workspace.id, name },
    });
    if (!channel || channel.private) {
      throw new NotFoundException('존재하지 않는 채널입니다.');
    }
    if (channel.archived) {
      throw new ForbiddenException('보관된 채널에는 참여할 수 없습니다.');
    }
    const already = await this.channelMembersRepository.findOne({
      where: { ChannelId: channel.id, UserId: myId },
    });
    if (!already) {
      await this.channelMembersRepository.save({
        ChannelId: channel.id,
        UserId: myId,
      });
    }
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
    const channel = await this.findWritableChannel(url, name, myId);
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
    // 초대받은 사람이 새로고침 없이 바로 이 채널 메시지를 받도록 소켓 방을 다시 맞춘다
    await this.eventsGateway.refreshUserChannels(url, user.id);
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

  // beforeId 가 있으면 그 메시지보다 오래된 것을 가져온다 (커서 방식).
  // 새 메시지가 계속 들어와도 페이지 경계가 밀려 같은 메시지가 중복되지 않는다.
  async getWorkspaceChannelChats(
    url: string,
    name: string,
    perPage: number,
    page: number,
    myId: number,
    beforeId?: number,
  ) {
    const channel = await this.findChannel(url, name, myId);
    // 스레드 답글은 채널 본문에 표시하지 않는다
    const query = this.chatQuery()
      .where('chats.ChannelId = :channelId', { channelId: channel.id })
      .andWhere('chats.ParentId IS NULL')
      .orderBy('chats.id', 'DESC')
      .take(perPage);
    if (beforeId) {
      query.andWhere('chats.id < :beforeId', { beforeId });
    } else {
      query.skip(perPage * (page - 1));
    }
    return query.getMany();
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
    await this.mentionsService.handleNewChat(
      url,
      channel.WorkspaceId,
      chatWithUser,
    );
    return chatWithUser;
  }

  async postChat(url: string, name: string, content: string, myId: number) {
    const channel = await this.findWritableChannel(url, name, myId);
    return this.saveAndBroadcast(url, channel, content, myId);
  }

  // 파일 전송: 채팅에는 파일 정보만 저장하고, 파일 내용은 디스크에 쓰지 않고 채널에 접속 중인 사람들에게 중계한다
  async sendChannelFiles(
    url: string,
    name: string,
    files: Express.Multer.File[],
    clientIds: string[],
    myId: number,
  ) {
    const channel = await this.findWritableChannel(url, name, myId);
    const chats = [];
    for (const [index, file] of files.entries()) {
      const meta = toFileMeta(file, clientIds[index]);
      chats.push(
        await this.saveAndBroadcast(url, channel, toFileContent(meta), myId),
      );
      this.emitToChannel(url, channel.id, 'fileData', {
        ...meta,
        data: file.buffer,
      });
    }
    return chats;
  }

  async editChat(
    url: string,
    name: string,
    chatId: number,
    content: string,
    myId: number,
  ) {
    const channel = await this.findWritableChannel(url, name, myId);
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
    const channel = await this.findWritableChannel(url, name, myId);
    const chat = await this.findChatInChannel(channel, chatId);
    if (chat.UserId !== myId) {
      throw new ForbiddenException('내가 보낸 메시지만 삭제할 수 있습니다.');
    }
    // 답글과 리액션은 FK ON DELETE CASCADE 로 함께 삭제된다. 멘션은 FK 가 없으므로 직접 지운다.
    const replies = await this.channelChatsRepository.find({
      where: { ParentId: chat.id },
      select: ['id'],
    });
    await this.channelChatsRepository.delete(chat.id);
    await this.mentionsService.removeForChats(url, [
      chat.id,
      ...replies.map((r) => r.id),
    ]);
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
    const channel = await this.findWritableChannel(url, name, myId);
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
    const channel = await this.findWritableChannel(url, name, myId);
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
    const channel = await this.findWritableChannel(url, name, myId);
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

  // 채널 알림 끄기/켜기 (나에게만 적용). 내 다른 탭의 채널 목록도 갱신한다.
  async setChannelMuted(
    url: string,
    name: string,
    myId: number,
    muted: boolean,
  ) {
    const channel = await this.findChannel(url, name, myId);
    await this.channelMembersRepository.update(
      { ChannelId: channel.id, UserId: myId },
      { muted },
    );
    this.eventsGateway.emitToUser(url, myId, 'channelsChanged');
  }

  // 채널 정보 변경: 주제는 채널 멤버 누구나, 이름은 관리자만
  async updateChannel(
    url: string,
    name: string,
    changes: { name?: string; topic?: string | null },
    myId: number,
  ) {
    let channel = await this.findChannel(url, name, myId);
    const update: Partial<Channels> = {};
    if (changes.name !== undefined && changes.name !== channel.name) {
      channel = await this.findManageableChannel(url, name, myId);
      const newName = changes.name.trim();
      this.assertChannelName(newName);
      const exists = await this.channelsRepository.findOne({
        where: { WorkspaceId: channel.WorkspaceId, name: newName },
      });
      if (exists) {
        throw new ForbiddenException('이미 존재하는 채널 이름입니다.');
      }
      update.name = newName;
    }
    if (changes.topic !== undefined) {
      update.topic = changes.topic?.trim() || null;
    }
    if (Object.keys(update).length) {
      await this.channelsRepository.update(channel.id, update);
    }
    return this.notifyChannelUpdated(url, channel, name);
  }

  async setArchived(
    url: string,
    name: string,
    archived: boolean,
    myId: number,
  ) {
    const channel = await this.findManageableChannel(url, name, myId);
    await this.channelsRepository.update(channel.id, { archived });
    return this.notifyChannelUpdated(url, channel, name);
  }

  // 채널 멤버들의 화면에 바뀐 채널 정보를 알린다 (이름이 바뀌면 보고 있던 주소도 옮긴다)
  private async notifyChannelUpdated(
    url: string,
    channel: Channels,
    oldName: string,
  ) {
    const updated = await this.channelsRepository.findOne({
      where: { id: channel.id },
    });
    await this.emitToChannelMembers(url, channel.id, 'channelUpdated', {
      ...updated,
      oldName,
    });
    return updated;
  }

  // 채널 멤버 각자에게 보낸다 (소켓 방 동기화 전이라도 받도록)
  private async emitToChannelMembers(
    url: string,
    channelId: number,
    event: string,
    data,
  ) {
    const members = await this.channelMembersRepository.find({
      where: { ChannelId: channelId },
      select: ['UserId'],
    });
    members.forEach(({ UserId }) =>
      this.eventsGateway.emitToUser(url, UserId, event, data),
    );
  }

  // 채널 삭제: 메시지(답글·리액션·저장 항목 포함)와 멘션을 함께 지운다
  async deleteChannel(url: string, name: string, myId: number) {
    const channel = await this.findManageableChannel(url, name, myId);
    const chats = await this.channelChatsRepository.find({
      where: { ChannelId: channel.id },
      select: ['id'],
    });
    const chatIds = chats.map((c) => c.id);
    await this.mentionsService.removeForChats(url, chatIds);
    if (chatIds.length) {
      await this.channelChatsRepository.delete(chatIds);
    }
    // 멤버 정보가 지워지기 전에 알린다
    await this.emitToChannelMembers(url, channel.id, 'channelDeleted', {
      id: channel.id,
      name: channel.name,
    });
    await this.channelsRepository.delete(channel.id);
  }
}
