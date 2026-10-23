import { ForbiddenException } from '@nestjs/common';
import { DocsService } from './docs.service';

// 댓글·링크 규칙만 확인한다 (권한 확인 access 는 흉내 낸다)
describe('문서 댓글·링크', () => {
  const comments = {
    findOne: jest.fn(),
    save: jest.fn(async (v) => ({ id: 1, ...v })),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: () => ({
        where: () => ({
          getRawMany: async () => [{ userId: 9 }, { userId: 5 }],
        }),
      }),
    })),
  };
  const links = { delete: jest.fn(), insert: jest.fn() };
  const docs = {
    update: jest.fn(),
    findOne: jest.fn(async () => ({ id: 3, WorkspaceId: 1 })),
    find: jest.fn(),
  };
  const gateway = { emitToWorkspace: jest.fn(), emitToUser: jest.fn() };
  let service: DocsService;
  const doc = { id: 3, title: '기획서', OwnerId: 7 };
  // 지금 문서를 볼 수 있는 사람
  let viewers: Set<number>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DocsService(
      docs as any,
      {} as any,
      {} as any,
      {} as any,
      links as any,
      comments as any,
      {} as any,
      gateway as any,
      {} as any,
    );
    jest
      .spyOn(service as any, 'access')
      .mockResolvedValue({ doc, canEdit: false, canManage: false });
    viewers = new Set([5, 7, 9]);
    jest
      .spyOn(service as any, 'canViewDoc')
      .mockImplementation(async (_doc: unknown, userId: unknown) =>
        viewers.has(userId as number),
      );
  });

  it('보기만 가능한 사람도 댓글을 달고, 문서 주인과 스레드 참여자에게 알린다 (나 빼고)', async () => {
    comments.findOne.mockResolvedValue({ id: 1, threadId: 'th-1234' });
    await service.addComment(
      'shlack',
      3,
      { threadId: 'th-1234', content: ' 좋아요 ', quote: '무시됨' },
      5,
    );
    expect(comments.save).toHaveBeenCalledWith(
      expect.objectContaining({
        DocId: 3,
        UserId: 5,
        content: '좋아요',
        quote: null,
      }),
    );
    const notified = gateway.emitToUser.mock.calls.map((c) => c[1]).sort();
    expect(notified).toEqual([7, 9]);
    expect(gateway.emitToWorkspace).toHaveBeenCalledWith(
      'shlack',
      'docCommentsChanged',
      { docId: 3 },
    );
  });

  it('권한을 잃은 스레드 참여자에게는 댓글 내용을 알리지 않는다', async () => {
    comments.findOne.mockResolvedValue({ id: 1, threadId: 'th-1234' });
    viewers.delete(9);
    await service.addComment(
      'shlack',
      3,
      { threadId: 'th-1234', content: '비밀 내용' },
      5,
    );
    const notified = gateway.emitToUser.mock.calls.map((c) => c[1]);
    expect(notified).toEqual([7]);
  });

  it('새 스레드의 첫 댓글에는 고른 글을 남긴다', async () => {
    comments.findOne.mockResolvedValue(null);
    await service.addComment(
      'shlack',
      3,
      { threadId: 'th-new1', content: '여기', quote: '인용할 글' },
      7,
    );
    expect(comments.save).toHaveBeenCalledWith(
      expect.objectContaining({ quote: '인용할 글' }),
    );
    // 주인이 단 첫 댓글이면 알릴 사람이 없다
    expect(gateway.emitToUser).not.toHaveBeenCalled();
  });

  it('남의 댓글은 고칠 수 없고, 지우는 것도 주인·관리자만', async () => {
    comments.findOne.mockResolvedValue({ id: 2, DocId: 3, UserId: 9 });
    await expect(
      service.editComment('shlack', 3, 2, '바꿈', 5),
    ).rejects.toThrow(ForbiddenException);
    await expect(service.deleteComment('shlack', 3, 2, 5)).rejects.toThrow(
      ForbiddenException,
    );
    await service.deleteComment('shlack', 3, 2, 7); // 문서 주인
    expect(comments.delete).toHaveBeenCalledWith(2);
  });

  it('저장한 글에서 같은 워크스페이스 문서 링크만 기억한다 (자기 자신 빼고)', async () => {
    docs.find.mockResolvedValue([{ id: 10 }]);
    await service.saveYdoc(
      'shlack',
      3,
      new Uint8Array([1]),
      5,
      '[계획](/workspace/shlack/docs/d/10) [나](/workspace/shlack/docs/d/3) [남](/workspace/other/docs/d/11)',
    );
    expect(docs.find.mock.calls[0][0].where.id._value).toEqual([10]);
    expect(links.delete).toHaveBeenCalledWith({ FromId: 3 });
    expect(links.insert).toHaveBeenCalledWith([{ FromId: 3, ToId: 10 }]);
  });
});
