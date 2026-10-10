import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelMembers } from '../entities/ChannelMembers';
import { Mentions } from '../entities/Mentions';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { MentionsController } from './mentions.controller';
import { MentionsService } from './mentions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Mentions, ChannelMembers]),
    WorkspacesModule,
  ],
  providers: [MentionsService],
  controllers: [MentionsController],
  exports: [MentionsService],
})
export class MentionsModule {}
