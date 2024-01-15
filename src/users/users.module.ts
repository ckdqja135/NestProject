import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from '../entities/Users';
import { Channelmembers } from '../entities/Channelmembers';
import { WorkspaceMembers } from '../../ch2/src/entities/WorkspaceMembers';

@Module({
  imports: [
    TypeOrmModule.forFeature([Users, WorkspaceMembers, Channelmembers]),
  ],
  providers: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
