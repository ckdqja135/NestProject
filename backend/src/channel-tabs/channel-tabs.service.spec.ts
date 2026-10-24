import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ChannelTabsService } from './channel-tabs.service';

// 채널 탭: 채널 멤버만, 새 문서는 채널 멤버 모두 편집, 있는 문서에 권한을 주려면 문서 관리자여야
describe('ChannelTabsService', () => {
  let tabs: Record<string, any>[];
  const tabsRepository = {
    find: jest.fn(async () => tabs),
    findOne: jest.fn(async ({ where, order }) => {
      if (order) return tabs.at(-1) || null;
      return (
        tabs.find(
          (t) =>
            (where.id === undefined || t.id === where.id) &&
            (where.DocId === undefined || t.DocId === where.DocId),
        ) || null
      );
    }),
    count: jest.fn(async () => tabs.length),
    save: jest.fn(async (v) => {
      const tab = { id: tabs.length + 1, ...v };
      tabs.push(tab);
      return tab;
    }),
    update: jest.fn(),
    delete: jest.fn(),
  };
  let channel: Record<string, any>;
  let member: unknown;
  const channelsRepository = { findOne: jest.fn(async () => channel) };
  const channelMembersRepository = { findOne: jest.fn(async () => member) };
  let role: string;
  const workspacesService = {
    findWorkspaceByUrl: jest.fn().mockResolvedValue({ id: 1 }),
    assertMember: jest.fn(async () => role),
  };
  let accessByDoc: Record<number, any>;
  const docsService = {
    createDoc: jest.fn(async () => ({ id: 77 })),
    accessOf: jest.fn(
      async (_url: string, id: number) => accessByDoc[id] ?? null,
    ),
  };
  const eventsGateway = {
    emitToWorkspace: jest.fn(),
    docAccessChanged: jest.fn(),
  };
  let service: ChannelTabsService;

  beforeEach(() => {
    jest.clearAllMocks();
    tabs = [];
    channel = {
      id: 3,
      name: '기획',
      private: false,
      archived: false,
      OwnerId: 9,
    };
    member = { UserId: 5 };
    role = 'member';
    accessByDoc = {
      77: { doc: { id: 77, title: '새 캔버스', type: 'doc' }, canManage: true },
      40: {
        doc: { id: 40, title: '남의 문서', type: 'doc' },
        canManage: false,
      },
    };
    service = new ChannelTabsService(
      tabsRepository as never,
      channelsRepository as never,
      channelMembersRepository as never,
      workspacesService as never,
      docsService as never,
      eventsGateway as never,
    );
  });

  it('채널에서 새로 만든 문서는 채널 멤버 모두 편집으로 탭에 붙는다', async () => {
    const tab = await service.add(
      'ws',
      '기획',
      { newType: 'doc', newTitle: '회의록' },
      5,
    );
    expect(docsService.createDoc).toHaveBeenCalledWith(
      'ws',
      { type: 'doc', title: '회의록', visibility: 'private' },
      5,
    );
    expect(tab).toEqual({ id: 1, docId: 77, access: 'edit' });
    expect(eventsGateway.docAccessChanged).toHaveBeenCalledWith('ws', 77);
    expect(eventsGateway.emitToWorkspace).toHaveBeenCalledWith(
      'ws',
      'channelTabsChanged',
      { channelId: 3 },
    );
  });

  it('남의 문서는 링크만 걸 수 있고, 권한을 주려면 문서 관리자여야 한다', async () => {
    await expect(
      service.add('ws', '기획', { docId: 40, access: 'view' }, 5),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.add('ws', '기획', { docId: 40 }, 5)).resolves.toEqual(
      expect.objectContaining({ access: 'none' }),
    );
    expect(eventsGateway.docAccessChanged).not.toHaveBeenCalled();
    await expect(
      service.add('ws', '기획', { docId: 40 }, 5),
    ).rejects.toBeInstanceOf(BadRequestException);
    // 볼 수 없는 문서는 걸 수 없다
    await expect(
      service.add('ws', '기획', { docId: 99 }, 5),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('채널 멤버가 아니거나 게스트·보관된 채널이면 바꿀 수 없다', async () => {
    member = null;
    await expect(service.list('ws', '기획', 5)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    channel.private = true;
    await expect(service.list('ws', '기획', 5)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    member = { UserId: 5 };
    role = 'guest';
    await expect(
      service.add('ws', '기획', { newType: 'doc' }, 5),
    ).rejects.toBeInstanceOf(ForbiddenException);
    role = 'member';
    channel.archived = true;
    await expect(
      service.add('ws', '기획', { newType: 'doc' }, 5),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('볼 수 없는 문서 탭은 제목을 숨긴다', async () => {
    tabs = [
      { id: 1, ChannelId: 3, DocId: 40, access: 'none', CreatorId: 9 },
      { id: 2, ChannelId: 3, DocId: 55, access: 'none', CreatorId: 9 },
    ];
    const list = await service.list('ws', '기획', 5);
    expect(list.map((t) => [t.docId, t.canView, t.title])).toEqual([
      [40, true, '남의 문서'],
      [55, false, null],
    ]);
  });

  it('탭은 만든 사람·채널 주인·관리자·문서 관리자만 뺀다', async () => {
    tabs = [{ id: 1, ChannelId: 3, DocId: 40, access: 'view', CreatorId: 8 }];
    await expect(service.remove('ws', '기획', 1, 5)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    role = 'admin';
    await service.remove('ws', '기획', 1, 5);
    expect(tabsRepository.delete).toHaveBeenCalledWith(1);
    expect(eventsGateway.docAccessChanged).toHaveBeenCalledWith('ws', 40);
  });
});
