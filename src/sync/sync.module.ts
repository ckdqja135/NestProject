import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Drafts } from '../entities/Drafts';
import { ReadMarkers } from '../entities/ReadMarkers';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([ReadMarkers, Drafts]), WorkspacesModule],
  providers: [SyncService],
  controllers: [SyncController],
})
export class SyncModule {}
