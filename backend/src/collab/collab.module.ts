import { Module } from '@nestjs/common';
import { DocsModule } from '../docs/docs.module';
import { TasksModule } from '../tasks/tasks.module';
import { CollabService } from './collab.service';

@Module({
  imports: [DocsModule, TasksModule],
  providers: [CollabService],
})
export class CollabModule {}
