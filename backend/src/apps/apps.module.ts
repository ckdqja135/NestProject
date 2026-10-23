import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelsModule } from '../channels/channels.module';
import { DmsModule } from '../dms/dms.module';
import { AppCommands } from '../entities/AppCommands';
import { Apps } from '../entities/Apps';
import { ChannelMembers } from '../entities/ChannelMembers';
import { Channels } from '../entities/Channels';
import { Reactions } from '../entities/Reactions';
import { Users } from '../entities/Users';
import { WorkspaceMembers } from '../entities/WorkspaceMembers';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AppTokenGuard } from './app-token.guard';
import { AppsApiController } from './apps-api.controller';
import { AppsController } from './apps.controller';
import { AppsService } from './apps.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Apps,
      AppCommands,
      Users,
      WorkspaceMembers,
      Channels,
      ChannelMembers,
      Reactions,
    ]),
    WorkspacesModule,
    ChannelsModule,
    DmsModule,
  ],
  providers: [AppsService, AppTokenGuard],
  controllers: [AppsController, AppsApiController],
})
export class AppsModule {}
