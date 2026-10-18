import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { Users } from '../entities/Users';
import { WorkspaceMembers } from '../entities/WorkspaceMembers';
import { Workspaces } from '../entities/Workspaces';

// 캘린더 어시스턴트: 일정 알림을 DM 으로 보내는 봇 계정
export const CALENDAR_BOT = {
  email: 'calendar@bot.shlack',
  nickname: '캘린더 어시스턴트',
};

@Injectable()
export class BotsService implements OnModuleInit {
  private logger = new Logger('BotsService');
  private calendarBotId: number | null = null;

  constructor(
    @InjectRepository(Users)
    private usersRepository: Repository<Users>,
    @InjectRepository(WorkspaceMembers)
    private membersRepository: Repository<WorkspaceMembers>,
    @InjectRepository(Workspaces)
    private workspacesRepository: Repository<Workspaces>,
  ) {}

  // 서버가 켜질 때 봇 계정을 만들고 모든 워크스페이스에 넣는다 (이미 있으면 그대로)
  async onModuleInit() {
    try {
      const botId = await this.getCalendarBotId();
      const workspaces = await this.workspacesRepository.find({
        select: ['id'],
      });
      for (const workspace of workspaces) {
        await this.ensureMember(workspace.id, botId);
      }
    } catch (error) {
      // 마이그레이션 전이면 (bot 컬럼이 없음) 다음 요청 때 다시 시도한다
      this.logger.warn(`봇 계정을 준비하지 못했습니다: ${error.message}`);
    }
  }

  async getCalendarBotId() {
    if (this.calendarBotId) {
      return this.calendarBotId;
    }
    let bot = await this.usersRepository.findOne({
      where: { email: CALENDAR_BOT.email },
    });
    if (!bot) {
      bot = await this.usersRepository.save({
        ...CALENDAR_BOT,
        bot: true,
        // 로그인할 수 없도록 아무도 모르는 비밀번호
        password: await bcrypt.hash(randomBytes(32).toString('hex'), 4),
      });
    }
    this.calendarBotId = bot.id;
    return bot.id;
  }

  // 워크스페이스에 봇을 멤버로 넣는다 (DM 목록에 보이도록). 봇 id 를 돌려준다
  async ensureMember(workspaceId: number, botId?: number) {
    const id = botId ?? (await this.getCalendarBotId());
    const exists = await this.membersRepository.findOne({
      where: { WorkspaceId: workspaceId, UserId: id },
    });
    if (!exists) {
      await this.membersRepository.save({
        WorkspaceId: workspaceId,
        UserId: id,
      });
    }
    return id;
  }

  async isBot(userId: number) {
    if (userId === this.calendarBotId) {
      return true;
    }
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'bot'],
    });
    return !!user?.bot;
  }
}
