import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Users } from '../entities/Users';
import { EventsGateway } from '../events/events.gateway';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  const usersRepository = { findOne: jest.fn() };
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
});
