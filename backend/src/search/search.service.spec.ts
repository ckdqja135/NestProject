import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChannelChats } from '../entities/ChannelChats';
import { DMs } from '../entities/DMs';
import { Docs } from '../entities/Docs';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { escapeLike, SearchService, startOfDay } from './search.service';

const createQueryBuilderMock = (result: unknown[]) => {
  const qb: Record<string, jest.Mock> = {};
  [
    'innerJoinAndSelect',
    'leftJoinAndSelect',
    'innerJoin',
    'where',
    'andWhere',
    'orderBy',
    'skip',
    'take',
    'leftJoin',
    'select',
    'addSelect',
    'addOrderBy',
    'limit',
  ].forEach((method) => {
    qb[method] = jest.fn(() => qb);
  });
  qb.getMany = jest.fn().mockResolvedValue(result);
  qb.getRawMany = jest.fn().mockResolvedValue(result);
  qb.getOne = jest.fn().mockResolvedValue(result[0] ?? null);
  return qb;
};

describe('SearchService', () => {
  let service: SearchService;
  const chatsQb = createQueryBuilderMock([{ id: 1 }]);
  const dmsQb = createQueryBuilderMock([{ id: 2 }]);
  const docsQb = createQueryBuilderMock([{ id: 3, title: '바나나 회의록' }]);
  const workspacesService = {
    findWorkspaceByUrl: jest.fn().mockResolvedValue({ id: 1 }),
    assertMember: jest.fn().mockResolvedValue('member'),
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
        {
          provide: getRepositoryToken(Docs),
          useValue: { createQueryBuilder: () => docsQb },
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
      docs: [{ id: 3, title: '바나나 회의록' }],
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

  it('기간 필터의 하루 경계를 사용자 시간대로 계산한다', () => {
    // 한국(UTC+9, getTimezoneOffset = -540): 10월 11일 0시 = 10월 10일 15시 UTC
    expect(startOfDay('2026-10-11', -540).toISOString()).toBe(
      '2026-10-10T15:00:00.000Z',
    );
    expect(startOfDay('2026-10-11', 0).toISOString()).toBe(
      '2026-10-11T00:00:00.000Z',
    );
    expect(Number.isNaN(startOfDay('2026-13-99', -540).getTime())).toBe(true);
  });

  it('게스트는 워크스페이스 공개 문서를 찾지 못한다', async () => {
    docsQb.andWhere.mockClear();
    workspacesService.assertMember.mockResolvedValueOnce('guest');
    await service.search('shlack', { q: '회의' }, 1);
    const visibility = docsQb.andWhere.mock.calls.find(([sql]) =>
      String(sql).includes('d.OwnerId = :me'),
    );
    expect(String(visibility?.[0])).not.toContain("visibility = 'workspace'");
  });

  it('문서 링크가 들어간 대화만 돌려준다 (d/12 와 d/123 을 구분)', async () => {
    chatsQb.getMany.mockResolvedValueOnce([
      { id: 1, content: '여기 /docs/d/12 봐 주세요' },
      { id: 2, content: '이건 /docs/d/123 이에요' },
    ]);
    dmsQb.getMany.mockResolvedValueOnce([]);
    const result = await service.docMentions('shlack', 12, 1);
    expect(result.chats.map((c: { id: number }) => c.id)).toEqual([1]);
  });
});
