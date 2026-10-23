import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChannelsService } from '../channels/channels.service';
import { DmsService } from '../dms/dms.service';
import { ChannelChats } from '../entities/ChannelChats';
import { ChannelMembers } from '../entities/ChannelMembers';
import { DMs } from '../entities/DMs';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { ForwardService } from './forward.service';

describe('ForwardService', () => {
  let service: ForwardService;
  const chats = { findOne: jest.fn() };
  const members = { findOne: jest.fn() };
  const dms = { findOne: jest.fn() };
  const channelsService = { postChat: jest.fn() };
  const dmsService = { createWorkspaceDMChats: jest.fn() };
  const workspacesService = {
    findWorkspaceByUrl: jest.fn().mockResolvedValue({ id: 1 }),
    assertMember: jest.fn(),
  };
  const createdAt = new Date('2026-10-23T01:00:00Z');

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ForwardService,
        { provide: getRepositoryToken(ChannelChats), useValue: chats },
        { provide: getRepositoryToken(ChannelMembers), useValue: members },
        { provide: getRepositoryToken(DMs), useValue: dms },
        { provide: WorkspacesService, useValue: workspacesService },
        { provide: ChannelsService, useValue: channelsService },
        { provide: DmsService, useValue: dmsService },
      ],
    }).compile();
    service = module.get(ForwardService);
  });

  const chat = (content: string, extra = {}) => ({
    id: 9,
    content,
    ChannelId: 3,
    ParentId: null,
    UserId: 7,
    User: { nickname: '동료' },
    Channel: { name: '일반', WorkspaceId: 1 },
    createdAt,
    ...extra,
  });

  it('채널 메시지를 원본 요약과 함께 다른 채널에 보내고, 원본 멘션은 글자로 바꾼다', async () => {
    chats.findOne.mockResolvedValue(chat('@[문서왕](5) 확인 부탁해요'));
    members.findOne.mockResolvedValue({ UserId: 5 });
    await service.forward(
      'shlack',
      { source: 'chat', id: 9 },
      { to: 'channel', target: '공지' },
      '  참고하세요 ',
      5,
    );
    const [, name, content, myId] = channelsService.postChat.mock.calls[0];
    expect([name, myId]).toEqual(['공지', 5]);
    expect(content.startsWith('fwd:')).toBe(true);
    expect(JSON.parse(content.slice(4))).toEqual({
      c: '참고하세요',
      m: {
        a: '동료',
        ai: 7,
        ch: '일반',
        at: createdAt.toISOString(),
        t: '@문서왕 확인 부탁해요',
        l: '/workspace/shlack/channel/%EC%9D%BC%EB%B0%98?message=9',
      },
    });
  });

  it('참여하지 않은 채널의 메시지는 전달할 수 없다', async () => {
    chats.findOne.mockResolvedValue(chat('비밀'));
    members.findOne.mockResolvedValue(null);
    await expect(
      service.forward(
        'shlack',
        { source: 'chat', id: 9 },
        { to: 'dm', target: 6 },
        '',
        5,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(dmsService.createWorkspaceDMChats).not.toHaveBeenCalled();
  });

  it('남의 DM 은 전달할 수 없다', async () => {
    dms.findOne.mockResolvedValue({
      id: 2,
      SenderId: 7,
      ReceiverId: 8,
      content: '안녕',
      createdAt,
    });
    await expect(
      service.forward(
        'shlack',
        { source: 'dm', id: 2 },
        { to: 'dm', target: 6 },
        '',
        5,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('파일·투표 메시지는 전달할 수 없다', async () => {
    members.findOne.mockResolvedValue({ UserId: 5 });
    for (const content of [
      'file:{"name":"a.png"}',
      'poll:{"q":"점심?","o":["a","b"]}',
    ]) {
      chats.findOne.mockResolvedValue(chat(content));
      await expect(
        service.forward(
          'shlack',
          { source: 'chat', id: 9 },
          { to: 'dm', target: 6 },
          '',
          5,
        ),
      ).rejects.toThrow(BadRequestException);
    }
  });

  it('전달한 메시지를 다시 전달하면 처음 원본을 그대로 옮긴다', async () => {
    const original = {
      a: '처음',
      ai: 1,
      ch: '일반',
      at: createdAt.toISOString(),
      t: '원래 글',
      l: null,
    };
    members.findOne.mockResolvedValue({ UserId: 5 });
    chats.findOne.mockResolvedValue(
      chat(`fwd:${JSON.stringify({ c: '중간', m: original })}`),
    );
    await service.forward(
      'shlack',
      { source: 'chat', id: 9 },
      { to: 'dm', target: 6 },
      '',
      5,
    );
    const content = dmsService.createWorkspaceDMChats.mock.calls[0][1];
    expect(JSON.parse(content.slice(4)).m).toEqual(original);
  });
});
