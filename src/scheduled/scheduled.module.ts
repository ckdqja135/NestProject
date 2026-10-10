import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelsModule } from '../channels/channels.module';
import { DmsModule } from '../dms/dms.module';
import { ChannelChats } from '../entities/ChannelChats';
import { ChannelMembers } from '../entities/ChannelMembers';
import { DMs } from '../entities/DMs';
import { Reminders } from '../entities/Reminders';
import { ScheduledMessages } from '../entities/ScheduledMessages';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ScheduledController } from './scheduled.controller';
import { ScheduledService } from './scheduled.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScheduledMessages,
      Reminders,
      ChannelChats,
      ChannelMembers,
      DMs,
    ]),
    WorkspacesModule,
    ChannelsModule,
    DmsModule,
  ],
  providers: [ScheduledService],
  controllers: [ScheduledController],
})
export class ScheduledModule {}
