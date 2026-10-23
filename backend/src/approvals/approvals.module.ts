import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BotsModule } from '../bots/bots.module';
import { ChannelsModule } from '../channels/channels.module';
import { DmsModule } from '../dms/dms.module';
import { ApprovalSteps } from '../entities/ApprovalSteps';
import { Approvals } from '../entities/Approvals';
import { ChannelMembers } from '../entities/ChannelMembers';
import { Channels } from '../entities/Channels';
import { Users } from '../entities/Users';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Approvals,
      ApprovalSteps,
      Users,
      Channels,
      ChannelMembers,
    ]),
    WorkspacesModule,
    ChannelsModule,
    DmsModule,
    BotsModule,
  ],
  providers: [ApprovalsService],
  controllers: [ApprovalsController],
})
export class ApprovalsModule {}
