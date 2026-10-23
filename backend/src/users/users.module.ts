import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from '../entities/Users';
import { WorkspaceMembers } from '../entities/WorkspaceMembers';
import { ChannelMembers } from '../entities/ChannelMembers';
import { PasswordResets } from '../entities/PasswordResets';
import { PasswordResetService } from './password-reset.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Users,
      WorkspaceMembers,
      ChannelMembers,
      PasswordResets,
    ]),
  ],
  providers: [UsersService, PasswordResetService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
