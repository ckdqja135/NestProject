import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChannelChats } from '../entities/ChannelChats';
import { DMs } from '../entities/DMs';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { escapeLike, SearchService } from './search.service';

const createQueryBuilderMock = (result: unknown[]) => {
  const qb: Record<string, jest.Mock> = {};
  [
    'innerJoinAndSelect',
    'innerJoin',
    'where',
    'andWhere',
    'orderBy',
    'skip',
    'take',
  ].forEach((method) => {
    qb[method] = jest.fn(() => qb);
  });
  qb.getMany = jest.fn().mockResolvedValue(result);
  return qb;
};

describe('SearchService', () => {
  let service: SearchService;
  const chatsQb = createQueryBuilderMock([{ id: 1 }]);
  const dmsQb = createQueryBuilderMock([{ id: 2 }]);
  const workspacesService = {
    findWorkspaceByUrl: jest.fn().mockResolvedValue({ id: 1 }),
    assertMember: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: getRepositoryToken(ChannelChats),
          useValue: { createQueryBuilder: () => chatsQb },
        },
        {
          provide: getRepositoryToken(DMs),
          useValue: { createQueryBuilder: () => dmsQb },
        },
        { provide: WorkspacesService, useValue: workspacesService },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('LIKE 와일드카드 문자를 이스케이프한다', () => {
    expect(escapeLike('100%_a\\b')).toBe('100\\%\\_a\\\\b');
  });

  it('빈 검색어는 BadRequestException', async () => {
    await expect(
      service.search('shlack', { q: '   ' }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('채널 메시지와 DM 검색 결과를 함께 반환한다', async () => {
    await expect(
      service.search('shlack', { q: ' 바나나 ' }, 1),
    ).resolves.toEqual({
      chats: [{ id: 1 }],
      dms: [{ id: 2 }],
      hasMoreChats: false,
      hasMoreDms: false,
    });
    expect(chatsQb.andWhere).toHaveBeenCalledWith('chats.content LIKE :like', {
      like: '%바나나%',
    });
    expect(workspacesService.assertMember).toHaveBeenCalledWith(1, 1);
  });

  it('채널을 지정하면 그 채널만 찾고 DM 은 제외한다', async () => {
    dmsQb.getMany.mockClear();
    const result = await service.search(
      'shlack',
      { channel: '자유', from: 3 },
      1,
    );
    expect(chatsQb.andWhere).toHaveBeenCalledWith('channel.name = :channel', {
      channel: '자유',
    });
    expect(chatsQb.andWhere).toHaveBeenCalledWith('chats.UserId = :from', {
      from: 3,
    });
    expect(dmsQb.getMany).not.toHaveBeenCalled();
    expect(result.dms).toEqual([]);
  });

  it('31개를 받으면 30개만 돌려주고 다음 페이지가 있다고 알린다', async () => {
    chatsQb.getMany.mockResolvedValueOnce(
      Array.from({ length: 31 }, (_, i) => ({ id: i })),
    );
    const result = await service.search('shlack', { q: '사과', page: 2 }, 1);
    expect(chatsQb.skip).toHaveBeenCalledWith(30);
    expect(result.chats).toHaveLength(30);
    expect(result.hasMoreChats).toBe(true);
  });
});
