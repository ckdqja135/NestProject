import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from '../entities/Users';
import { WorkspaceMembers } from '../entities/WorkspaceMembers';
import { Workspaces } from '../entities/Workspaces';
import { BotsService } from './bots.service';

// 어디서나 봇 계정을 쓸 수 있게 전역 모듈
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Users, WorkspaceMembers, Workspaces])],
  providers: [BotsService],
  exports: [BotsService],
})
export class BotsModule {}
