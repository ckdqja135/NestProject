import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelChats } from '../entities/ChannelChats';
import { ChannelMembers } from '../entities/ChannelMembers';
import { SidebarPins } from '../entities/SidebarPins';
import { WorkspaceMembers } from '../entities/WorkspaceMembers';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { PinsController } from './pins.controller';
import { PinsService } from './pins.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SidebarPins,
      ChannelChats,
      ChannelMembers,
      WorkspaceMembers,
    ]),
    WorkspacesModule,
  ],
  providers: [PinsService],
  controllers: [PinsController],
})
export class PinsModule {}
