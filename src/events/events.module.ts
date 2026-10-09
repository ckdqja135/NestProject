import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelMembers } from '../entities/ChannelMembers';
import { WorkspaceMembers } from '../entities/WorkspaceMembers';
import { EventsGateway } from './events.gateway';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceMembers, ChannelMembers])],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
