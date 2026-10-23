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
import { DocLinks } from '../entities/DocLinks';
import { DocComments } from '../entities/DocComments';
import { DocAccessRequests } from '../entities/DocAccessRequests';
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
  const requestsRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  };
  const workspacesService = {
    findWorkspaceByUrl: jest.fn().mockResolvedValue({ id: 1, OwnerId: 99 }),
    assertMember: jest.fn(),
    roleOf: jest.fn().mockResolvedValue('member'),
  };
  const eventsGateway = {
    emitToWorkspace: jest.fn(),
    emitToUser: jest.fn(),
    docAccessChanged: jest.fn(),
  };
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
        { provide: getRepositoryToken(DocLinks), useValue: {} },
        { provide: getRepositoryToken(DocComments), useValue: {} },
        {
          provide: getRepositoryToken(DocAccessRequests),
          useValue: requestsRepository,
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

  it('워크스페이스 공개 문서는 기본으로 보기만, 편집으로 바꾸면 초대받지 않은 멤버도 고친다', async () => {
    workspacesService.assertMember.mockResolvedValue('member');
    docsRepository.findOne.mockResolvedValue(
      doc({ visibility: 'workspace', linkRole: 'view' }),
    );
    await expect(
      service.updateDoc('shlack', 5, { content: 'x', version: 3 }, 2),
    ).rejects.toBeInstanceOf(ForbiddenException);
    docsRepository.findOne.mockResolvedValue(
      doc({ visibility: 'workspace', linkRole: 'edit' }),
    );
    await expect(
      service.updateDoc('shlack', 5, { content: 'x', version: 3 }, 2),
    ).resolves.toEqual(expect.objectContaining({ version: 4 }));
    // 게스트는 공개 문서라도 초대받지 않으면 볼 수 없다
    workspacesService.assertMember.mockResolvedValue('guest');
    await expect(
      service.updateDoc('shlack', 5, { content: 'x', version: 3 }, 2),
    ).rejects.toBeInstanceOf(NotFoundException);
    workspacesService.assertMember.mockResolvedValue(undefined);
  });

  it('공개 범위·공유를 바꾸면 열어 둔 연결의 권한을 다시 계산한다', async () => {
    docsRepository.findOne.mockResolvedValue(doc());
    await service.updateSettings('shlack', 5, { linkRole: 'edit' }, 1);
    expect(eventsGateway.docAccessChanged).toHaveBeenCalledWith(
      'shlack',
      5,
      undefined,
    );
    await service.removeShare('shlack', 5, 3, 1);
    expect(eventsGateway.docAccessChanged).toHaveBeenCalledWith('shlack', 5, 3);
  });

  it('권한이 없으면 주인에게 접근을 요청하고, 이미 있으면 요청할 필요가 없다', async () => {
    docsRepository.findOne.mockResolvedValue(doc());
    requestsRepository.findOne.mockResolvedValue(null);
    await expect(
      service.requestAccess(
        'shlack',
        5,
        { role: 'edit', message: ' 부탁해요 ' },
        2,
      ),
    ).resolves.toEqual({ requested: true });
    expect(requestsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        DocId: 5,
        UserId: 2,
        role: 'edit',
        message: '부탁해요',
      }),
    );
    // 주인(1)에게 알린다
    expect(eventsGateway.emitToUser).toHaveBeenCalledWith(
      'shlack',
      1,
      'docsChanged',
      { id: 5 },
    );
    sharesRepository.findOne.mockResolvedValue({ role: 'view' });
    await expect(
      service.requestAccess('shlack', 5, { role: 'view' }, 2),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('요청을 허락하면 공유하고, 거절하면 요청만 지운다 (주인·관리자만)', async () => {
    docsRepository.findOne.mockResolvedValue(doc());
    requestsRepository.findOne.mockResolvedValue({
      id: 8,
      DocId: 5,
      UserId: 3,
      role: 'view',
    });
    await expect(
      service.decideAccessRequest('shlack', 5, 8, { decision: 'approve' }, 2),
    ).rejects.toBeInstanceOf(NotFoundException); // 2 는 문서를 볼 수도 없다
    await service.decideAccessRequest(
      'shlack',
      5,
      8,
      { decision: 'approve', role: 'edit' },
      1,
    );
    expect(sharesRepository.save).toHaveBeenCalledWith({
      DocId: 5,
      UserId: 3,
      role: 'edit',
    });
    expect(requestsRepository.delete).toHaveBeenCalledWith(8);
    expect(eventsGateway.emitToUser).toHaveBeenCalledWith(
      'shlack',
      3,
      'docAccess',
      { id: 5, decision: 'approve' },
    );
    sharesRepository.save.mockClear();
    await service.decideAccessRequest('shlack', 5, 8, { decision: 'deny' }, 1);
    expect(sharesRepository.save).not.toHaveBeenCalled();
  });
});
