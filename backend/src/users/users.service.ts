import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DndSchedule } from '../common/dnd';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import bcrypt from 'bcrypt';
import { Users } from '../entities/Users';
import { ChannelMembers } from '../entities/ChannelMembers';
import { WorkspaceMembers } from '../entities/WorkspaceMembers';
import { Workspaces } from '../entities/Workspaces';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Users)
    private usersRepository: Repository<Users>,
    private dataSource: DataSource,
    private eventsGateway: EventsGateway,
  ) {}

  async join(email: string, nickname: string, password: string) {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (user) {
      throw new ForbiddenException('이미 존재하는 사용자입니다.');
    }
    const hashedPassword = await bcrypt.hash(password, 12);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const returned = await queryRunner.manager.getRepository(Users).save({
        email,
        nickname,
        password: hashedPassword,
      });
      // 기본 워크스페이스(shlack)와 기본 채널(일반)에 자동 가입
      await queryRunner.manager.getRepository(WorkspaceMembers).save({
        UserId: returned.id,
        WorkspaceId: 1,
      });
      await queryRunner.manager.getRepository(ChannelMembers).save({
        UserId: returned.id,
        ChannelId: 1,
      });
      // 시드로 만든 기본 워크스페이스는 소유자가 없으므로 첫 가입자를 소유자로 지정한다
      await queryRunner.manager
        .createQueryBuilder()
        .update(Workspaces)
        .set({ OwnerId: returned.id })
        .where('id = :id AND OwnerId IS NULL', { id: 1 })
        .execute();
      await queryRunner.commitTransaction();
      // 기본 워크스페이스에 접속 중인 사람들의 멤버 목록(DM 목록)에 새 멤버를 바로 반영
      const defaultWorkspace = await this.dataSource
        .getRepository(Workspaces)
        .findOne({ where: { id: 1 }, select: ['url'] });
      if (defaultWorkspace) {
        this.eventsGateway.emitToWorkspace(
          defaultWorkspace.url,
          'membersChanged',
        );
      }
      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // 닉네임/아바타/상태 변경. 내가 속한 워크스페이스 사람들의 멤버 목록에도 바로 반영한다.
  async updateProfile(
    myId: number,
    changes: {
      nickname?: string;
      avatarStyle?: string;
      statusEmoji?: string | null;
      statusText?: string | null;
      away?: boolean;
      department?: string | null;
      jobTitle?: string | null;
      phone?: string | null;
    },
  ) {
    const update: Partial<Users> = {};
    (['department', 'jobTitle', 'phone'] as const).forEach((key) => {
      if (changes[key] !== undefined) {
        update[key] = changes[key]?.trim() || null;
      }
    });
    if (changes.nickname !== undefined) {
      update.nickname = changes.nickname.trim();
      if (!update.nickname) {
        throw new BadRequestException('닉네임을 입력해주세요.');
      }
    }
    if (changes.avatarStyle !== undefined) {
      update.avatarStyle = changes.avatarStyle;
    }
    if (changes.statusEmoji !== undefined) {
      update.statusEmoji = changes.statusEmoji?.trim() || null;
    }
    if (changes.statusText !== undefined) {
      update.statusText = changes.statusText?.trim() || null;
    }
    if (changes.away !== undefined) {
      update.away = changes.away;
    }
    if (Object.keys(update).length) {
      await this.usersRepository.update(myId, update);
    }
    const user = await this.usersRepository.findOne({
      where: { id: myId },
      select: [
        'id',
        'email',
        'nickname',
        'avatarStyle',
        'statusEmoji',
        'statusText',
        'department',
        'jobTitle',
        'phone',
        'away',
        'theme',
        'notificationsPaused',
        'dndSchedule',
      ],
    });
    const workspaces = await this.dataSource
      .getRepository(Workspaces)
      .createQueryBuilder('workspace')
      .innerJoin(
        'workspace.WorkspaceMembers',
        'members',
        'members.UserId = :myId',
        {
          myId,
        },
      )
      .select(['workspace.url'])
      .getMany();
    workspaces.forEach((workspace) => {
      this.eventsGateway.emitToWorkspace(workspace.url, 'membersChanged');
      this.eventsGateway.emitToWorkspace(workspace.url, 'profileUpdated', user);
    });
    return user;
  }

  // 화면 테마·알림 일시 중지 (내 계정 설정). 내 다른 기기/탭에도 바로 반영한다.
  async updatePreferences(
    myId: number,
    changes: {
      theme?: string;
      notificationsPaused?: boolean;
      dndSchedule?: DndSchedule | null;
    },
  ) {
    const update: Partial<Users> = {};
    if (changes.dndSchedule !== undefined) {
      update.dndSchedule = changes.dndSchedule
        ? JSON.stringify({
            on: changes.dndSchedule.on,
            start: changes.dndSchedule.start,
            end: changes.dndSchedule.end,
            days: [...new Set(changes.dndSchedule.days)].sort(),
            tz: changes.dndSchedule.tz,
          })
        : null;
    }
    if (changes.theme !== undefined) {
      update.theme = changes.theme;
    }
    if (changes.notificationsPaused !== undefined) {
      update.notificationsPaused = changes.notificationsPaused;
    }
    if (Object.keys(update).length) {
      await this.usersRepository.update(myId, update);
    }
    const user = await this.usersRepository.findOne({
      where: { id: myId },
      select: ['id', 'theme', 'notificationsPaused', 'dndSchedule'],
    });
    this.eventsGateway.emitToUserEverywhere(myId, 'preferencesChanged', {
      theme: user.theme,
      notificationsPaused: user.notificationsPaused,
      dndSchedule: user.dndSchedule,
    });
    // 방해 금지 표시(🌙)가 다른 사람 화면에도 바뀌도록 멤버 목록을 새로 받게 한다
    if (changes.dndSchedule !== undefined) {
      const workspaces = await this.dataSource
        .getRepository(Workspaces)
        .createQueryBuilder('workspace')
        .innerJoin(
          'workspace.WorkspaceMembers',
          'members',
          'members.UserId = :myId',
          { myId },
        )
        .select(['workspace.url'])
        .getMany();
      workspaces.forEach((workspace) =>
        this.eventsGateway.emitToWorkspace(workspace.url, 'membersChanged'),
      );
    }
    return user;
  }

  async changePassword(
    myId: number,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.usersRepository.findOne({
      where: { id: myId },
      select: ['id', 'password'],
    });
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      throw new BadRequestException('현재 비밀번호가 맞지 않습니다.');
    }
    await this.usersRepository.update(myId, {
      password: await bcrypt.hash(newPassword, 12),
    });
  }
}
