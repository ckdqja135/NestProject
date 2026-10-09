import { Test, TestingModule } from '@nestjs/testing';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';

describe('ChannelsController', () => {
  let controller: ChannelsController;
  const channelsService = { postChat: jest.fn(), leaveChannel: jest.fn() };

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

  it('채팅 전송 후 저장된 메시지를 반환한다', async () => {
    const saved = { id: 1, content: '안녕' };
    channelsService.postChat.mockResolvedValue(saved);
    await expect(
      controller.postChat('shlack', '일반', { content: '안녕' }, {
        id: 1,
      } as any),
    ).resolves.toBe(saved);
    expect(channelsService.postChat).toHaveBeenCalledWith(
      'shlack',
      '일반',
      '안녕',
      1,
    );
  });

  it('채널 나가기 후 ok 를 반환한다', async () => {
    await expect(
      controller.leaveChannel('shlack', '자유', { id: 1 } as any),
    ).resolves.toBe('ok');
    expect(channelsService.leaveChannel).toHaveBeenCalledWith(
      'shlack',
      '자유',
      1,
    );
  });
});
