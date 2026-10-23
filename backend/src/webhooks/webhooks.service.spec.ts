import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChannelsService } from '../channels/channels.service';
import { Webhooks } from '../entities/Webhooks';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { WebhooksService } from './webhooks.service';

describe('WebhooksService', () => {
  let service: WebhooksService;
  const webhooksRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn((v) => v),
    delete: jest.fn(),
  };
  const channelsService = {
    getWorkspaceChannel: jest.fn().mockResolvedValue({ id: 4 }),
    postBotMessage: jest.fn().mockResolvedValue({ id: 99 }),
  };
  const workspacesService = {
    findWorkspaceByUrl: jest.fn(),
    roleOf: jest.fn().mockResolvedValue('member'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: getRepositoryToken(Webhooks), useValue: webhooksRepository },
        { provide: ChannelsService, useValue: channelsService },
        { provide: WorkspacesService, useValue: workspacesService },
      ],
    }).compile();
    service = module.get(WebhooksService);
  });

  it('만들면 추측할 수 없는 토큰을 발급한다', async () => {
    const a = await service.createWebhook('shlack', '일반', ' GitHub ', 1);
    const b = await service.createWebhook('shlack', '일반', 'GitHub', 1);
    expect(a).toEqual(
      expect.objectContaining({ ChannelId: 4, name: 'GitHub', CreatorId: 1 }),
    );
    expect(a.token).toMatch(/^[0-9a-f]{48}$/);
    expect(a.token).not.toBe(b.token);
  });

  it('토큰으로 받은 메시지를 웹훅 이름(또는 지정한 이름)으로 채널에 올린다', async () => {
    webhooksRepository.findOne.mockResolvedValue({
      ChannelId: 4,
      name: 'GitHub',
    });
    await service.receive('tok', '배포 완료', undefined);
    expect(channelsService.postBotMessage).toHaveBeenCalledWith(
      4,
      '배포 완료',
      'GitHub',
    );
    await service.receive('tok', '빌드 실패', 'CI');
    expect(channelsService.postBotMessage).toHaveBeenLastCalledWith(
      4,
      '빌드 실패',
      'CI',
    );
  });

  it('없는 토큰은 404', async () => {
    webhooksRepository.findOne.mockResolvedValue(null);
    await expect(service.receive('nope', 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('만든 사람도 관리자도 아니면 지울 수 없다', async () => {
    webhooksRepository.findOne.mockResolvedValue({ id: 3, CreatorId: 2 });
    await expect(
      service.deleteWebhook('shlack', '일반', 3, 1),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(webhooksRepository.delete).not.toHaveBeenCalled();
  });
});
