import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CustomEmojis } from '../entities/CustomEmojis';
import { EventsGateway } from '../events/events.gateway';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { EmojisService } from './emojis.service';

describe('EmojisService', () => {
  let service: EmojisService;
  const emojisRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn((v) => v),
    delete: jest.fn(),
  };
  const workspacesService = {
    findWorkspaceByUrl: jest.fn().mockResolvedValue({ id: 1, OwnerId: 9 }),
    // 9 번은 소유자
    assertMember: jest.fn((_ws: number, id: number) =>
      Promise.resolve(id === 9 ? 'owner' : 'member'),
    ),
  };
  const eventsGateway = { emitToWorkspace: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmojisService,
        {
          provide: getRepositoryToken(CustomEmojis),
          useValue: emojisRepository,
        },
        { provide: WorkspacesService, useValue: workspacesService },
        { provide: EventsGateway, useValue: eventsGateway },
      ],
    }).compile();
    service = module.get(EmojisService);
  });

  it('이모지를 올리고 워크스페이스에 알린다, 같은 이름은 거부', async () => {
    emojisRepository.findOne.mockResolvedValueOnce(null);
    await service.createEmoji(
      'shlack',
      'parrot',
      'data:image/png;base64,AAAA',
      1,
    );
    expect(emojisRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ WorkspaceId: 1, name: 'parrot', CreatorId: 1 }),
    );
    expect(eventsGateway.emitToWorkspace).toHaveBeenCalledWith(
      'shlack',
      'emojisChanged',
    );
    emojisRepository.findOne.mockResolvedValueOnce({ id: 1 });
    await expect(
      service.createEmoji('shlack', 'parrot', 'data:image/png;base64,AAAA', 2),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('올린 사람도 관리자도 아니면 지울 수 없다', async () => {
    emojisRepository.findOne.mockResolvedValue({ id: 3, CreatorId: 2 });
    await expect(service.deleteEmoji('shlack', 3, 1)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await service.deleteEmoji('shlack', 3, 9);
    expect(emojisRepository.delete).toHaveBeenCalledWith(3);
  });
});
