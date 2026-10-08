import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DmsService } from './dms.service';
import { DmsController } from './dms.controller';
import { DMs } from '../entities/DMs';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [TypeOrmModule.forFeature([DMs]), WorkspacesModule],
  providers: [DmsService],
  controllers: [DmsController],
})
export class DmsModule {}
