import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Not, Repository } from 'typeorm';
import { Channels } from '../entities/Channels';
import { ChannelMembers } from '../entities/ChannelMembers';
import { ChannelChats } from '../entities/ChannelChats';
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

  async getWorkspaceChannelChats(
    url: string,
    name: string,
    perPage: number,
    page: number,
    myId: number,
  ) {
    const channel = await this.findChannel(url, name, myId);
    return this.channelChatsRepository.find({
      where: { ChannelId: channel.id },
      relations: ['User', 'Channel'],
      order: { createdAt: 'DESC', id: 'DESC' },
      take: perPage,
      skip: perPage * (page - 1),
    });
  }

  async getChannelUnreadsCount(
    url: string,
    name: string,
    after: number,
    myId: number,
  ) {
    const channel = await this.findChannel(url, name, myId);
    // 내가 보낸 메시지는 안 읽은 메시지로 세지 않는다
    return this.channelChatsRepository.count({
      where: {
        ChannelId: channel.id,
        UserId: Not(myId),
        createdAt: MoreThan(new Date(after)),
      },
    });
  }

  private async saveAndBroadcast(
    url: string,
    channel: Channels,
    content: string,
    myId: number,
  ) {
    const saved = await this.channelChatsRepository.save({
      content,
      UserId: myId,
      ChannelId: channel.id,
    });
    const chatWithUser = await this.channelChatsRepository.findOne({
      where: { id: saved.id },
      relations: ['User', 'Channel'],
    });
    this.eventsGateway.server
      .to(`/ws-${url}-${channel.id}`)
      .emit('message', chatWithUser);
    return chatWithUser;
  }

  async postChat(url: string, name: string, content: string, myId: number) {
    const channel = await this.findChannel(url, name, myId);
    await this.saveAndBroadcast(url, channel, content, myId);
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
}
