import { Test, TestingModule } from '@nestjs/testing';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';

describe('ChannelsController', () => {
  let controller: ChannelsController;
  const channelsService = { postChat: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChannelsController],
      providers: [{ provide: ChannelsService, useValue: channelsService }],
    }).compile();

    controller = module.get<ChannelsController>(ChannelsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('채팅 전송 후 ok 를 반환한다', async () => {
    await expect(
      controller.postChat('sleact', '일반', { content: '안녕' }, {
        id: 1,
      } as any),
    ).resolves.toBe('ok');
    expect(channelsService.postChat).toHaveBeenCalledWith(
      'sleact',
      '일반',
      '안녕',
      1,
    );
  });
});
