import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import { PasswordResets } from '../entities/PasswordResets';
import { Users } from '../entities/Users';
import { MailService } from '../mail/mail.service';

export const RESET_TTL_MS = 30 * 60_000;

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

const appUrl = () =>
  (process.env.APP_URL || 'http://localhost:3090').replace(/\/$/, '');

// 비밀번호 찾기: 메일로 30분 동안 쓸 수 있는 1회용 링크를 보내고, 그 링크로 새 비밀번호를 정한다
@Injectable()
export class PasswordResetService {
  private logger = new Logger('PasswordReset');

  constructor(
    @InjectRepository(Users)
    private usersRepository: Repository<Users>,
    @InjectRepository(PasswordResets)
    private resetsRepository: Repository<PasswordResets>,
    private mailService: MailService,
  ) {}

  // 가입한 이메일인지 알려 주지 않도록 결과는 항상 같다
  async request(email: string) {
    const user = await this.usersRepository.findOne({
      where: { email: email.trim().toLowerCase(), bot: false },
      select: ['id', 'email', 'nickname'],
    });
    // 오래된 링크는 지운다
    await this.resetsRepository.delete({ expiresAt: LessThan(new Date()) });
    if (!user) {
      return;
    }
    await this.resetsRepository.delete({ UserId: user.id, usedAt: IsNull() });
    const token = randomBytes(32).toString('base64url');
    await this.resetsRepository.save({
      UserId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    });
    const link = `${appUrl()}/reset-password?token=${token}`;
    const sent = await this.mailService.send({
      to: user.email,
      subject: '[Shlack] 비밀번호 재설정',
      text: [
        `${user.nickname} 님, 비밀번호 재설정을 요청하셨어요.`,
        '',
        '아래 링크에서 새 비밀번호를 정해 주세요. 링크는 30분 동안 한 번만 쓸 수 있어요.',
        link,
        '',
        '요청하지 않으셨다면 이 메일은 무시하셔도 됩니다. 비밀번호는 바뀌지 않아요.',
      ].join('\n'),
    });
    if (!sent) {
      // 메일 서버가 없는 개발 환경에서는 서버 로그로 링크를 확인한다
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn(`메일을 보내지 못해 링크를 로그에 남깁니다: ${link}`);
      } else {
        this.logger.error(
          'SMTP_URL 이 없어 비밀번호 재설정 메일을 보내지 못했습니다.',
        );
      }
    }
  }

  async reset(token: string, password: string) {
    const reset = await this.resetsRepository.findOne({
      where: {
        tokenHash: hashToken(token || ''),
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
    if (!reset) {
      throw new BadRequestException(
        '링크가 만료되었거나 이미 사용되었습니다. 다시 요청해 주세요.',
      );
    }
    await this.usersRepository.update(reset.UserId, {
      password: await bcrypt.hash(password, 12),
    });
    await this.resetsRepository.update(reset.id, { usedAt: new Date() });
    // 같은 사람의 다른 링크도 더는 못 쓰게
    await this.resetsRepository.delete({
      UserId: reset.UserId,
      usedAt: IsNull(),
    });
  }
}
