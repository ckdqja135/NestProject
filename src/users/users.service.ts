import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from '../entities/Users';
import bcrypt from 'bcrypt';
@Injectable()
export class UsersService {
  constructor() {}
  @InjectRepository(Users)
  private usersRepository: Repository<Users>;
  getUser() {}
  async join(email: string, nickname: string, password: string) {
    if (!email) {
      throw new HttpException('이메일이 없습니다.', 400);
    }
    if (!nickname) {
      throw new HttpException('닉네임이 없습니다.', 400);
    }
    if (!password) {
      throw new HttpException('비밀번호가 없습니다.', 400);
    }

    const user = await this.usersRepository.findOne({ where: { email } });

    if (user) {
      throw new HttpException('이미 존재하는 사용자입니다.', 400);
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await this.usersRepository.save({
      email,
      nickname,
      password: hashedPassword,
    });
  }
}
