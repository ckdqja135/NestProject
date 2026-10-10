import bcrypt from 'bcrypt';
import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Users } from '../entities/Users';
import { EventsGateway } from '../events/events.gateway';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  const usersRepository = { findOne: jest.fn(), update: jest.fn() };
  const save = jest.fn();
  const ownerUpdate = {
    update: jest.fn(() => ownerUpdate),
    set: jest.fn(() => ownerUpdate),
    where: jest.fn(() => ownerUpdate),
    execute: jest.fn(),
  };
  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      getRepository: jest.fn(() => ({ save })),
      createQueryBuilder: jest.fn(() => ownerUpdate),
    },
  };
  const dataSource = {
    createQueryRunner: jest.fn(() => queryRunner),
    getRepository: jest.fn(() => ({
      findOne: jest.fn().mockResolvedValue({ url: 'shlack' }),
      createQueryBuilder: () => {
        const qb = {
          innerJoin: () => qb,
          select: () => qb,
          getMany: jest
            .fn()
            .mockResolvedValue([{ url: 'shlack' }, { url: 'team' }]),
        };
        return qb;
      },
    })),
  };
  const eventsGateway = { emitToWorkspace: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(Users), useValue: usersRepository },
        { provide: DataSource, useValue: dataSource },
        { provide: EventsGateway, useValue: eventsGateway },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('이미 가입된 이메일이면 ForbiddenException', async () => {
    usersRepository.findOne.mockResolvedValue({ id: 1 });
    await expect(service.join('a@a.com', 'a', '1234')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('가입 시 사용자 저장 후 기본 워크스페이스/채널에 참여시키고 커밋한다', async () => {
    usersRepository.findOne.mockResolvedValue(null);
    save.mockResolvedValueOnce({ id: 7 });

    await expect(service.join('a@a.com', 'a', '1234')).resolves.toBe(true);

    expect(save).toHaveBeenNthCalledWith(1, {
      email: 'a@a.com',
      nickname: 'a',
      password: expect.not.stringMatching(/^1234$/),
    });
    expect(save).toHaveBeenNthCalledWith(2, { UserId: 7, WorkspaceId: 1 });
    expect(save).toHaveBeenNthCalledWith(3, { UserId: 7, ChannelId: 1 });
    // 기본 워크스페이스에 소유자가 없을 때만 첫 가입자를 소유자로
    expect(ownerUpdate.set).toHaveBeenCalledWith({ OwnerId: 7 });
    expect(ownerUpdate.where).toHaveBeenCalledWith(
      'id = :id AND OwnerId IS NULL',
      {
        id: 1,
      },
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
    expect(eventsGateway.emitToWorkspace).toHaveBeenCalledWith(
      'shlack',
      'membersChanged',
    );
  });

  it('저장 중 에러가 나면 롤백하고 에러를 던진다', async () => {
    usersRepository.findOne.mockResolvedValue(null);
    save.mockRejectedValueOnce(new Error('db error'));

    await expect(service.join('a@a.com', 'a', '1234')).rejects.toThrow(
      'db error',
    );
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });

  describe('프로필', () => {
    it('닉네임/아바타를 바꾸고 내가 속한 워크스페이스마다 알린다', async () => {
      usersRepository.findOne.mockResolvedValue({ id: 7, nickname: '새이름' });
      await service.updateProfile(7, {
        nickname: '  새이름 ',
        avatarStyle: 'identicon',
      });
      expect(usersRepository.update).toHaveBeenCalledWith(7, {
        nickname: '새이름',
        avatarStyle: 'identicon',
      });
      expect(eventsGateway.emitToWorkspace).toHaveBeenCalledWith(
        'team',
        'membersChanged',
      );
      expect(eventsGateway.emitToWorkspace).toHaveBeenCalledWith(
        'shlack',
        'profileUpdated',
        { id: 7, nickname: '새이름' },
      );
    });

    it('공백뿐인 닉네임은 거부한다', async () => {
      await expect(
        service.updateProfile(7, { nickname: '   ' }),
      ).rejects.toThrow('닉네임을 입력해주세요.');
    });

    it('현재 비밀번호가 틀리면 비밀번호를 바꾸지 않는다', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 7,
        password: await bcrypt.hash('right', 4),
      });
      await expect(
        service.changePassword(7, 'wrong', 'newpass'),
      ).rejects.toThrow('현재 비밀번호가 맞지 않습니다.');
      expect(usersRepository.update).not.toHaveBeenCalled();
    });

    it('현재 비밀번호가 맞으면 새 비밀번호를 해시해서 저장한다', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 7,
        password: await bcrypt.hash('right', 4),
      });
      await service.changePassword(7, 'right', 'newpass');
      const saved = usersRepository.update.mock.calls[0][1].password;
      expect(saved).not.toBe('newpass');
      expect(await bcrypt.compare('newpass', saved)).toBe(true);
    });
  });
});
