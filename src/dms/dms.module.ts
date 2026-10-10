import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DmsService } from './dms.service';
import { DmsController } from './dms.controller';
import { DMs } from '../entities/DMs';
import { DMReactions } from '../entities/DMReactions';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [TypeOrmModule.forFeature([DMs, DMReactions]), WorkspacesModule],
  providers: [DmsService],
  controllers: [DmsController],
})
export class DmsModule {}
