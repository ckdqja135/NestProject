import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  const usersService = { join: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('로그인하지 않았으면 내 정보로 false 를 반환한다', () => {
    expect(controller.getUsers(undefined)).toBe(false);
  });

  it('로그인했으면 사용자 정보를 반환한다', () => {
    const user = { id: 1, email: 'a@a.com' };
    expect(controller.getUsers(user)).toBe(user);
  });

  it('회원가입은 서비스에 위임하고 ok 를 반환한다', async () => {
    await expect(
      controller.join({ email: 'a@a.com', nickname: 'a', password: '1234' }),
    ).resolves.toBe('ok');
    expect(usersService.join).toHaveBeenCalledWith('a@a.com', 'a', '1234');
  });
});
