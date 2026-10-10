import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChannelChats } from '../entities/ChannelChats';
import { ChannelMembers } from '../entities/ChannelMembers';
import { DMs } from '../entities/DMs';
import { SavedItems } from '../entities/SavedItems';
import { EventsGateway } from '../events/events.gateway';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { SavedService } from './saved.service';

describe('SavedService', () => {
  let service: SavedService;
  const savedRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const channelChatsRepository = { findOne: jest.fn() };
  const channelMembersRepository = { findOne: jest.fn() };
  const dmsRepository = { findOne: jest.fn() };
  const workspacesService = {
    findWorkspaceByUrl: jest.fn(),
    assertMember: jest.fn(),
  };
  const eventsGateway = { emitToUser: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavedService,
        { provide: getRepositoryToken(SavedItems), useValue: savedRepository },
        {
          provide: getRepositoryToken(ChannelChats),
          useValue: channelChatsRepository,
        },
        {
          provide: getRepositoryToken(ChannelMembers),
          useValue: channelMembersRepository,
        },
        { provide: getRepositoryToken(DMs), useValue: dmsRepository },
        { provide: WorkspacesService, useValue: workspacesService },
        { provide: EventsGateway, useValue: eventsGateway },
      ],
    }).compile();
    service = module.get(SavedService);
    workspacesService.findWorkspaceByUrl.mockResolvedValue({ id: 1 });
  });

  it('참여 중인 채널의 메시지를 저장하고 내 탭들에 알린다', async () => {
    channelChatsRepository.findOne.mockResolvedValue({
      id: 9,
      ChannelId: 4,
      Channel: { WorkspaceId: 1 },
    });
    channelMembersRepository.findOne.mockResolvedValue({ UserId: 1 });
    savedRepository.findOne.mockResolvedValue(null);
    await service.save('shlack', { chatId: 9 }, 1);
    expect(savedRepository.save).toHaveBeenCalledWith({
      UserId: 1,
      ChatId: 9,
      WorkspaceId: 1,
    });
    expect(eventsGateway.emitToUser).toHaveBeenCalledWith(
      'shlack',
      1,
      'savedChanged',
    );
  });

  it('참여하지 않은 채널의 메시지는 저장할 수 없다', async () => {
    channelChatsRepository.findOne.mockResolvedValue({
      id: 9,
      ChannelId: 4,
      Channel: { WorkspaceId: 1 },
    });
    channelMembersRepository.findOne.mockResolvedValue(null);
    await expect(
      service.save('shlack', { chatId: 9 }, 1),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(savedRepository.save).not.toHaveBeenCalled();
  });

  it('다른 사람끼리 나눈 DM 은 저장할 수 없다', async () => {
    dmsRepository.findOne.mockResolvedValue({
      id: 5,
      SenderId: 2,
      ReceiverId: 3,
    });
    await expect(service.save('shlack', { dmId: 5 }, 1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('이미 저장한 메시지는 다시 저장하지 않는다', async () => {
    dmsRepository.findOne.mockResolvedValue({
      id: 5,
      SenderId: 2,
      ReceiverId: 1,
    });
    savedRepository.findOne.mockResolvedValue({ id: 3 });
    await service.save('shlack', { dmId: 5 }, 1);
    expect(savedRepository.save).not.toHaveBeenCalled();
  });
});
