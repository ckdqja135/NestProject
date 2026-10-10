import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';
import { ThreadsController } from './threads.controller';
import { Channels } from '../entities/Channels';
import { ChannelMembers } from '../entities/ChannelMembers';
import { ChannelChats } from '../entities/ChannelChats';
import { Reactions } from '../entities/Reactions';
import { Users } from '../entities/Users';
import { WorkspaceMembers } from '../entities/WorkspaceMembers';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { MentionsModule } from '../mentions/mentions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Channels,
      ChannelMembers,
      ChannelChats,
      Reactions,
      Users,
      WorkspaceMembers,
    ]),
    WorkspacesModule,
    MentionsModule,
  ],
  providers: [ChannelsService],
  controllers: [ChannelsController, ThreadsController],
})
export class ChannelsModule {}
