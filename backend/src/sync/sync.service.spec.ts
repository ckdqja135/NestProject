import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Drafts } from '../entities/Drafts';
import { ReadMarkers } from '../entities/ReadMarkers';
import { EventsGateway } from '../events/events.gateway';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { SyncService } from './sync.service';

describe('SyncService', () => {
  let service: SyncService;
  // 채널 멤버인지 확인하는 쿼리
  const query = jest.fn().mockResolvedValue([{ 1: 1 }]);
  const markersRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    manager: { query },
  };
  const draftsRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const workspacesService = {
    findWorkspaceByUrl: jest.fn().mockResolvedValue({ id: 1 }),
    assertMember: jest.fn(),
  };
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));
  const eventsGateway = { emitToUser: jest.fn(), server: { to } };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        {
          provide: getRepositoryToken(ReadMarkers),
          useValue: markersRepository,
        },
        { provide: getRepositoryToken(Drafts), useValue: draftsRepository },
        { provide: WorkspacesService, useValue: workspacesService },
        { provide: EventsGateway, useValue: eventsGateway },
      ],
    }).compile();
    service = module.get(SyncService);
  });

  it('읽은 시각은 앞으로만 가고, 바뀌면 내 다른 기기에 알린다', async () => {
    markersRepository.findOne.mockResolvedValue({ lastReadAt: new Date(1000) });
    await expect(
      service.putReadMarker('shlack', 'c:3', 500, 7),
    ).resolves.toEqual({
      key: 'c:3',
      at: 1000,
    });
    expect(markersRepository.save).not.toHaveBeenCalled();

    await service.putReadMarker('shlack', 'c:3', 2000, 7);
    expect(markersRepository.save).toHaveBeenCalledWith({
      UserId: 7,
      WorkspaceId: 1,
      key: 'c:3',
      lastReadAt: new Date(2000),
    });
    expect(eventsGateway.emitToUser).toHaveBeenCalledWith(
      'shlack',
      7,
      'readMarker',
      {
        key: 'c:3',
        at: 2000,
      },
    );
    // 채널을 보는 사람들에게도 ("몇 명 읽음")
    expect(to).toHaveBeenCalledWith('/ws-shlack-3');
    expect(emit).toHaveBeenCalledWith('channelRead', {
      channelId: 3,
      userId: 7,
      at: 2000,
    });
  });

  it('기기 시계가 앞서 있어도 미래 시각으로 기록하지 않는다', async () => {
    markersRepository.findOne.mockResolvedValue(null);
    const result = await service.putReadMarker(
      'shlack',
      'd:2',
      Date.now() + 86400000,
      7,
    );
    expect(result.at).toBeLessThanOrEqual(Date.now());
  });

  it('임시 저장 글은 나중에 고친 쪽이 이기고, 빈 내용이면 지운다', async () => {
    draftsRepository.findOne.mockResolvedValue({
      content: '새 글',
      updatedAt: new Date(3000),
    });
    await expect(
      service.putDraft('shlack', 'dm:2', '옛 글', 2000, 7),
    ).resolves.toEqual({
      key: 'dm:2',
      content: '새 글',
      at: 3000,
    });
    expect(draftsRepository.save).not.toHaveBeenCalled();

    await service.putDraft('shlack', 'dm:2', '   ', 4000, 7);
    expect(draftsRepository.delete).toHaveBeenCalledWith({
      UserId: 7,
      WorkspaceId: 1,
      key: 'dm:2',
    });
  });

  it('읽은 위치와 임시 저장 글을 한 번에 돌려준다', async () => {
    markersRepository.find.mockResolvedValue([
      { key: 't:9', lastReadAt: new Date(5) },
    ]);
    draftsRepository.find.mockResolvedValue([
      { key: 'channel:일반', content: '안녕', updatedAt: new Date(6) },
    ]);
    await expect(service.getSync('shlack', 7)).resolves.toEqual({
      readMarkers: { 't:9': 5 },
      drafts: { 'channel:일반': { content: '안녕', at: 6 } },
    });
  });
});
