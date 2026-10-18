import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DocFolders } from '../entities/DocFolders';
import { Docs } from '../entities/Docs';
import { DocShares } from '../entities/DocShares';
import { DocUserStates } from '../entities/DocUserStates';
import { EventsGateway } from '../events/events.gateway';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { DocsService } from './docs.service';

describe('DocsService', () => {
  let service: DocsService;
  const docsRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn((v) => ({ id: 10, ...v })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    softDelete: jest.fn(),
  };
  const foldersRepository = { findOne: jest.fn() };
  const sharesRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const statesRepository = { findOne: jest.fn(), save: jest.fn() };
  const workspacesService = {
    findWorkspaceByUrl: jest.fn().mockResolvedValue({ id: 1, OwnerId: 99 }),
    assertMember: jest.fn(),
  };
  const eventsGateway = { emitToWorkspace: jest.fn(), emitToUser: jest.fn() };
  const doc = (over = {}) => ({
    id: 5,
    WorkspaceId: 1,
    type: 'doc',
    title: '문서',
    visibility: 'private',
    OwnerId: 1,
    version: 3,
    ...over,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocsService,
        { provide: getRepositoryToken(Docs), useValue: docsRepository },
        {
          provide: getRepositoryToken(DocFolders),
          useValue: foldersRepository,
        },
        { provide: getRepositoryToken(DocShares), useValue: sharesRepository },
        {
          provide: getRepositoryToken(DocUserStates),
          useValue: statesRepository,
        },
        { provide: WorkspacesService, useValue: workspacesService },
        { provide: EventsGateway, useValue: eventsGateway },
      ],
    }).compile();
    service = module.get(DocsService);
    sharesRepository.findOne.mockResolvedValue(null);
    docsRepository.update.mockResolvedValue({ affected: 1 });
  });

  it('비공개 문서는 공유받지 않은 사람에게 없는 것처럼 보인다', async () => {
    docsRepository.findOne.mockResolvedValue(doc());
    await expect(
      service.updateDoc('shlack', 5, { content: 'x', version: 3 }, 2),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('보기로 공유받은 사람은 고칠 수 없고, 편집으로 공유받으면 고칠 수 있다', async () => {
    docsRepository.findOne.mockResolvedValue(doc());
    sharesRepository.findOne.mockResolvedValue({ role: 'view' });
    await expect(
      service.updateDoc('shlack', 5, { content: 'x', version: 3 }, 2),
    ).rejects.toBeInstanceOf(ForbiddenException);
    sharesRepository.findOne.mockResolvedValue({ role: 'edit' });
    await expect(
      service.updateDoc('shlack', 5, { content: 'x', version: 3 }, 2),
    ).resolves.toEqual(expect.objectContaining({ version: 4 }));
    expect(docsRepository.update).toHaveBeenCalledWith(
      { id: 5, version: 3 },
      expect.objectContaining({ content: 'x', version: 4, LastEditorId: 2 }),
    );
  });

  it('다른 사람이 먼저 저장했으면 덮어쓰지 않고 409', async () => {
    docsRepository.findOne.mockResolvedValue(doc({ version: 4 }));
    await expect(
      service.updateDoc('shlack', 5, { content: 'x', version: 3 }, 1),
    ).rejects.toBeInstanceOf(ConflictException);
    // 버전 확인과 저장 사이에 다른 저장이 끼어든 경우
    docsRepository.findOne.mockResolvedValue(doc());
    docsRepository.update.mockResolvedValueOnce({ affected: 0 });
    await expect(
      service.updateDoc('shlack', 5, { content: 'x', version: 3 }, 1),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('위키 페이지는 항상 워크스페이스 공개로 만든다', async () => {
    await service.createDoc(
      'shlack',
      { type: 'wiki', visibility: 'private', folderId: 3 },
      1,
    );
    expect(docsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'wiki',
        visibility: 'workspace',
        FolderId: null,
        title: '제목 없는 페이지',
      }),
    );
  });

  it('위키 페이지를 자기 하위 페이지 아래로 옮길 수 없다', async () => {
    docsRepository.findOne
      .mockResolvedValueOnce(doc({ type: 'wiki', visibility: 'workspace' })) // 옮길 페이지(5)
      .mockResolvedValueOnce({ id: 7, type: 'wiki' }) // 새 상위 페이지가 위키인지
      .mockResolvedValueOnce({ id: 7, ParentId: 5 }); // 7 의 상위가 5 → 고리
    await expect(
      service.updateSettings('shlack', 5, { parentId: 7 }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('공유는 만든 사람이나 워크스페이스 소유자만, 공유받은 사람에게 알린다', async () => {
    docsRepository.findOne.mockResolvedValue(doc({ visibility: 'workspace' }));
    await expect(
      service.setShare('shlack', 5, 3, 'edit', 2),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await service.setShare('shlack', 5, 3, 'edit', 1);
    expect(sharesRepository.save).toHaveBeenCalledWith({
      DocId: 5,
      UserId: 3,
      role: 'edit',
    });
    expect(eventsGateway.emitToUser).toHaveBeenCalledWith(
      'shlack',
      3,
      'docShared',
      expect.objectContaining({ id: 5 }),
    );
  });
});
