import { Test, TestingModule } from '@nestjs/testing';
import { DmsController } from './dms.controller';
import { DmsService } from './dms.service';

describe('DmsController', () => {
  let controller: DmsController;
  const dmsService = { createWorkspaceDMChats: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DmsController],
      providers: [{ provide: DmsService, useValue: dmsService }],
    }).compile();

    controller = module.get<DmsController>(DmsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('DM 전송 후 ok 를 반환한다', async () => {
    await expect(
      controller.postChat('sleact', 2, { content: '안녕' }, { id: 1 } as any),
    ).resolves.toBe('ok');
    expect(dmsService.createWorkspaceDMChats).toHaveBeenCalledWith(
      'sleact',
      '안녕',
      2,
      1,
    );
  });
});
