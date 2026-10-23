import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Users } from '../entities/Users';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Users) private usersRepository: Repository<Users>,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersRepository.findOne({
      where: { email },
      select: [
        'id',
        'email',
        'password',
        'nickname',
        'avatarStyle',
        'statusEmoji',
        'statusText',
        'away',
        'theme',
        'notificationsPaused',
        'dndSchedule',
      ],
    });
    if (!user) {
      return null;
    }
    const result = await bcrypt.compare(password, user.password);
    if (result) {
      // 비밀번호 해시는 응답에서 뺀다
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _hash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    }
    return null;
  }
}
