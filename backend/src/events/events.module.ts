import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelChats } from '../entities/ChannelChats';
import { ChannelMembers } from '../entities/ChannelMembers';
import { DMs } from '../entities/DMs';
import { WorkspaceMembers } from '../entities/WorkspaceMembers';
import { EventsGateway } from './events.gateway';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspaceMembers,
      ChannelMembers,
      ChannelChats,
      DMs,
    ]),
  ],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
