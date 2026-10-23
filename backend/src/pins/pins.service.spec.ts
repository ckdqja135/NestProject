import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChannelChats } from '../entities/ChannelChats';
import { ChannelMembers } from '../entities/ChannelMembers';
import { SidebarPins } from '../entities/SidebarPins';
import { WorkspaceMembers } from '../entities/WorkspaceMembers';
import { EventsGateway } from '../events/events.gateway';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { MAX_PINS, PinsService } from './pins.service';

describe('PinsService', () => {
  let service: PinsService;
  const pinsRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  };
  const channelChatsRepository = { findOne: jest.fn() };
  const channelMembersRepository = { findOne: jest.fn() };
  const workspaceMembersRepository = { findOne: jest.fn() };
  const workspacesService = {
    findWorkspaceByUrl: jest.fn(),
    assertMember: jest.fn(),
  };
  const eventsGateway = { emitToUser: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PinsService,
        { provide: getRepositoryToken(SidebarPins), useValue: pinsRepository },
        {
          provide: getRepositoryToken(ChannelChats),
          useValue: channelChatsRepository,
        },
        {
          provide: getRepositoryToken(ChannelMembers),
          useValue: channelMembersRepository,
        },
        {
          provide: getRepositoryToken(WorkspaceMembers),
          useValue: workspaceMembersRepository,
        },
        { provide: WorkspacesService, useValue: workspacesService },
        { provide: EventsGateway, useValue: eventsGateway },
      ],
    }).compile();
    service = module.get(PinsService);
    workspacesService.findWorkspaceByUrl.mockResolvedValue({ id: 1 });
    pinsRepository.count.mockResolvedValue(0);
  });

  it('참여 중인 채널을 맨 아래 순서로 고정하고 내 탭들에 알린다', async () => {
    channelMembersRepository.findOne.mockResolvedValue({
      Channel: { WorkspaceId: 1 },
    });
    pinsRepository.findOne
      .mockResolvedValueOnce(null) // 이미 고정했는지
      .mockResolvedValueOnce({ position: 4 }); // 마지막 순서
    await service.pin('shlack', 'channel', 3, 7);
    expect(pinsRepository.save).toHaveBeenCalledWith({
      UserId: 7,
      WorkspaceId: 1,
      ChannelId: 3,
      kind: 'channel',
      position: 5,
    });
    expect(eventsGateway.emitToUser).toHaveBeenCalledWith(
      'shlack',
      7,
      'sidebarPinsChanged',
    );
  });

  it('참여하지 않은 채널은 고정할 수 없다', async () => {
    channelMembersRepository.findOne.mockResolvedValue(null);
    await expect(service.pin('shlack', 'channel', 3, 7)).rejects.toThrow(
      NotFoundException,
    );
    expect(pinsRepository.save).not.toHaveBeenCalled();
  });

  it('다른 워크스페이스 사람과의 DM 은 고정할 수 없다', async () => {
    workspaceMembersRepository.findOne.mockResolvedValue(null);
    await expect(service.pin('shlack', 'dm', 9, 7)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('스레드는 첫 메시지만 고정할 수 있다', async () => {
    channelChatsRepository.findOne.mockResolvedValue({
      id: 20,
      ChannelId: 3,
      ParentId: 10,
      Channel: { WorkspaceId: 1 },
    });
    channelMembersRepository.findOne.mockResolvedValue({ UserId: 7 });
    await expect(service.pin('shlack', 'thread', 20, 7)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('이미 고정했으면 다시 만들지 않는다', async () => {
    workspaceMembersRepository.findOne.mockResolvedValue({ UserId: 9 });
    pinsRepository.findOne.mockResolvedValue({ id: 1 });
    await service.pin('shlack', 'dm', 9, 7);
    expect(pinsRepository.save).not.toHaveBeenCalled();
  });

  it(`${MAX_PINS}개를 넘게 고정할 수 없다`, async () => {
    workspaceMembersRepository.findOne.mockResolvedValue({ UserId: 9 });
    pinsRepository.findOne.mockResolvedValue(null);
    pinsRepository.count.mockResolvedValue(MAX_PINS);
    await expect(service.pin('shlack', 'dm', 9, 7)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('모르는 종류는 거절한다', async () => {
    await expect(service.pin('shlack', 'folder', 1, 7)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('순서를 바꾸면 내 고정만, 빠진 것은 뒤에 원래 순서대로 둔다', async () => {
    pinsRepository.find.mockResolvedValue([
      { id: 1, position: 0 },
      { id: 2, position: 1 },
      { id: 3, position: 2 },
    ]);
    await service.reorder('shlack', [3, 99, 1], 7);
    expect(pinsRepository.update.mock.calls).toEqual([
      [{ id: 3 }, { position: 0 }],
      [{ id: 1 }, { position: 1 }],
      [{ id: 2 }, { position: 2 }],
    ]);
  });
});
