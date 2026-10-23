import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ContactStars } from '../entities/ContactStars';
import { Contacts } from '../entities/Contacts';
import { WorkspaceMembers } from '../entities/WorkspaceMembers';
import { EventsGateway } from '../events/events.gateway';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { ContactsService, MAX_CONTACTS } from './contacts.service';

describe('ContactsService', () => {
  let service: ContactsService;
  const contactsRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const starsRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
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
        ContactsService,
        { provide: getRepositoryToken(Contacts), useValue: contactsRepository },
        {
          provide: getRepositoryToken(ContactStars),
          useValue: starsRepository,
        },
        {
          provide: getRepositoryToken(WorkspaceMembers),
          useValue: workspaceMembersRepository,
        },
        { provide: WorkspacesService, useValue: workspacesService },
        { provide: EventsGateway, useValue: eventsGateway },
      ],
    }).compile();
    service = module.get(ContactsService);
    workspacesService.findWorkspaceByUrl.mockResolvedValue({ id: 1 });
    contactsRepository.count.mockResolvedValue(0);
  });

  it('외부 연락처를 다듬어서(빈 칸은 null) 내 것으로 저장하고 내 탭들에 알린다', async () => {
    contactsRepository.save.mockImplementation(async (v) => ({ id: 3, ...v }));
    await service.create(
      'shlack',
      {
        name: '  홍길동 ',
        company: '',
        email: 'hong@example.com',
        starred: true,
      },
      7,
    );
    expect(contactsRepository.save).toHaveBeenCalledWith({
      name: '홍길동',
      company: null,
      email: 'hong@example.com',
      starred: true,
      OwnerId: 7,
      WorkspaceId: 1,
    });
    expect(eventsGateway.emitToUser).toHaveBeenCalledWith(
      'shlack',
      7,
      'contactsChanged',
    );
  });

  it('이름을 비우면 거절한다', async () => {
    await expect(service.create('shlack', { name: '   ' }, 7)).rejects.toThrow(
      BadRequestException,
    );
  });

  it(`외부 연락처는 ${MAX_CONTACTS}개까지`, async () => {
    contactsRepository.count.mockResolvedValue(MAX_CONTACTS);
    await expect(
      service.create('shlack', { name: '홍길동' }, 7),
    ).rejects.toThrow(BadRequestException);
  });

  it('남의 연락처는 고치거나 지울 수 없다', async () => {
    contactsRepository.findOne.mockResolvedValue(null);
    await expect(
      service.update('shlack', 3, { name: '바꿈' }, 7),
    ).rejects.toThrow(NotFoundException);
    await expect(service.remove('shlack', 3, 7)).rejects.toThrow(
      NotFoundException,
    );
    expect(contactsRepository.findOne).toHaveBeenCalledWith({
      where: { id: 3, OwnerId: 7, WorkspaceId: 1 },
    });
    expect(contactsRepository.update).not.toHaveBeenCalled();
    expect(contactsRepository.delete).not.toHaveBeenCalled();
  });

  it('워크스페이스에 없는 사람에게는 별표할 수 없다', async () => {
    workspaceMembersRepository.findOne.mockResolvedValue(null);
    await expect(service.setStar('shlack', 9, true, 7)).rejects.toThrow(
      NotFoundException,
    );
    expect(starsRepository.save).not.toHaveBeenCalled();
  });

  it('동료 별표를 켜고 끈다', async () => {
    workspaceMembersRepository.findOne.mockResolvedValue({ UserId: 9 });
    starsRepository.findOne.mockResolvedValue(null);
    await service.setStar('shlack', 9, true, 7);
    expect(starsRepository.save).toHaveBeenCalledWith({
      UserId: 7,
      WorkspaceId: 1,
      MemberId: 9,
    });
    await service.setStar('shlack', 9, false, 7);
    expect(starsRepository.delete).toHaveBeenCalledWith({
      UserId: 7,
      WorkspaceId: 1,
      MemberId: 9,
    });
  });
});
