import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { PasswordResets } from '../entities/PasswordResets';
import { Users } from '../entities/Users';
import { MailService } from '../mail/mail.service';
import { PasswordResetService } from './password-reset.service';

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  const users = { findOne: jest.fn(), update: jest.fn() };
  const resets = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const mail = { send: jest.fn().mockResolvedValue(true) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: getRepositoryToken(Users), useValue: users },
        { provide: getRepositoryToken(PasswordResets), useValue: resets },
        { provide: MailService, useValue: mail },
      ],
    }).compile();
    service = module.get(PasswordResetService);
  });

  it('가입한 이메일이면 링크를 메일로 보내고, DB 에는 토큰 해시만 남긴다', async () => {
    users.findOne.mockResolvedValue({ id: 3, email: 'a@t.io', nickname: '가' });
    await service.request(' A@t.io ');
    expect(users.findOne.mock.calls[0][0].where).toEqual({
      email: 'a@t.io',
      bot: false,
    });
    const text: string = mail.send.mock.calls[0][0].text;
    const token = /token=([\w-]+)/.exec(text)![1];
    const saved = resets.save.mock.calls[0][0];
    expect(saved.tokenHash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(saved.tokenHash).not.toContain(token);
    expect(saved.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('없는 이메일이어도 똑같이 끝나고 메일은 보내지 않는다', async () => {
    users.findOne.mockResolvedValue(null);
    await expect(service.request('none@t.io')).resolves.toBeUndefined();
    expect(mail.send).not.toHaveBeenCalled();
    expect(resets.save).not.toHaveBeenCalled();
  });

  it('맞는 토큰이면 비밀번호를 바꾸고 링크를 다 쓴 것으로 표시한다', async () => {
    resets.findOne.mockResolvedValue({ id: 8, UserId: 3 });
    await service.reset('tok', 'newpass1');
    const [id, values] = users.update.mock.calls[0];
    expect(id).toBe(3);
    expect(await bcrypt.compare('newpass1', values.password)).toBe(true);
    expect(resets.update.mock.calls[0][0]).toBe(8);
    expect(resets.findOne.mock.calls[0][0].where.tokenHash).toBe(
      createHash('sha256').update('tok').digest('hex'),
    );
  });

  it('만료됐거나 이미 쓴 토큰은 거절한다', async () => {
    resets.findOne.mockResolvedValue(null);
    await expect(service.reset('old', 'newpass1')).rejects.toThrow(
      BadRequestException,
    );
    expect(users.update).not.toHaveBeenCalled();
  });
});
