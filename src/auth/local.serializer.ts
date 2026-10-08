import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from '../entities/Users';
import { Workspaces } from '../entities/Workspaces';

@Injectable()
export class LocalSerializer extends PassportSerializer {
  constructor(
    @InjectRepository(Users) private usersRepository: Repository<Users>,
    @InjectRepository(Workspaces)
    private workspacesRepository: Repository<Workspaces>,
  ) {
    super();
  }

  serializeUser(user: Users, done: CallableFunction) {
    done(null, user.id);
  }

  async deserializeUser(userId: string, done: CallableFunction) {
    try {
      const user = await this.usersRepository.findOne({
        where: { id: +userId },
        select: ['id', 'email', 'nickname'],
      });
      if (!user) {
        // 세션에 남아있는 사용자가 삭제된 경우 로그아웃 상태로 처리
        return done(null, false);
      }
      user.Workspaces = await this.workspacesRepository.find({
        where: { WorkspaceMembers: { UserId: user.id } },
        order: { id: 'ASC' },
      });
      done(null, user);
    } catch (error) {
      done(error);
    }
  }
}
