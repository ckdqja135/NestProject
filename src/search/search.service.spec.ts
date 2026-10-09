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
    await expect(service.search('sleact', '   ', 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('채널 메시지와 DM 검색 결과를 함께 반환한다', async () => {
    await expect(service.search('sleact', ' 바나나 ', 1)).resolves.toEqual({
      chats: [{ id: 1 }],
      dms: [{ id: 2 }],
    });
    expect(chatsQb.andWhere).toHaveBeenCalledWith('chats.content LIKE :like', {
      like: '%바나나%',
    });
    expect(workspacesService.assertMember).toHaveBeenCalledWith(1, 1);
  });
});
