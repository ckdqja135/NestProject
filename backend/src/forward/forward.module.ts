import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelsModule } from '../channels/channels.module';
import { DmsModule } from '../dms/dms.module';
import { ChannelChats } from '../entities/ChannelChats';
import { ChannelMembers } from '../entities/ChannelMembers';
import { DMs } from '../entities/DMs';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ForwardController } from './forward.controller';
import { ForwardService } from './forward.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChannelChats, ChannelMembers, DMs]),
    WorkspacesModule,
    ChannelsModule,
    DmsModule,
  ],
  providers: [ForwardService],
  controllers: [ForwardController],
})
export class ForwardModule {}
