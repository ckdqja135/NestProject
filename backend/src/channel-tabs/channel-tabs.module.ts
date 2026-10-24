import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocsModule } from '../docs/docs.module';
import { ChannelMembers } from '../entities/ChannelMembers';
import { Channels } from '../entities/Channels';
import { ChannelTabs } from '../entities/ChannelTabs';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ChannelTabsController } from './channel-tabs.controller';
import { ChannelTabsService } from './channel-tabs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChannelTabs, Channels, ChannelMembers]),
    WorkspacesModule,
    DocsModule,
  ],
  providers: [ChannelTabsService],
  controllers: [ChannelTabsController],
})
export class ChannelTabsModule {}
