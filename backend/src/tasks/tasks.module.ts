import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BotsModule } from '../bots/bots.module';
import { DmsModule } from '../dms/dms.module';
import { DocTasks } from '../entities/DocTasks';
import { Docs } from '../entities/Docs';
import { Users } from '../entities/Users';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocTasks, Docs, Users]),
    WorkspacesModule,
    DmsModule,
    BotsModule,
  ],
  providers: [TasksService],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}
