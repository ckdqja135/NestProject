import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelChats } from '../entities/ChannelChats';
import { ChannelMembers } from '../entities/ChannelMembers';
import { DMs } from '../entities/DMs';
import { SavedItems } from '../entities/SavedItems';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { SavedController } from './saved.controller';
import { SavedService } from './saved.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SavedItems, ChannelChats, ChannelMembers, DMs]),
    WorkspacesModule,
  ],
  providers: [SavedService],
  controllers: [SavedController],
})
export class SavedModule {}
