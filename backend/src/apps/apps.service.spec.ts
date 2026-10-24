import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { postToApp } from './app-http';
import { AppsService } from './apps.service';

jest.mock('./app-http', () => ({
  ...jest.requireActual('./app-http'),
  postToApp: jest.fn(),
}));

// 앱: 토큰은 한 번만 보여 주고 해시로 찾는다, 슬래시 명령 답을 채널 또는 나에게만
describe('AppsService', () => {
  let saved: Record<string, any>;
  const appsRepository = {
    save: jest.fn(
      async (v) => (saved = { id: 4, createdAt: new Date(), ...v }),
    ),
    findOne: jest.fn(async ({ where }) => {
      if (where.tokenHash) {
        return where.tokenHash === saved?.tokenHash
          ? { ...saved, Workspace: { url: 'ws' } }
          : null;
      }
      return { ...saved, signingSecret: 'sec' };
    }),
    update: jest.fn(),
  };
  const command = {
    id: 1,
    command: 'deploy',
    url: 'https://app.example/cmd',
    App: { id: 4, name: '배포봇', BotUserId: 50 },
  };
  const commandsRepository = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
  };
  const usersRepository = {
    save: jest.fn(async (v) => ({ id: 50, ...v })),
    findOne: jest.fn(async () => ({ id: 5, nickname: '문서왕' })),
  };
  const membersRepository = { save: jest.fn() };
  const channelsRepository = {
    findOne: jest.fn(async () => ({ id: 9, name: '배포', archived: false })),
    createQueryBuilder: jest.fn(() => {
      const qb: any = {
        innerJoin: () => qb,
        select: () => qb,
        orderBy: () => qb,
        getMany: async () => [],
      };
      return qb;
    }),
  };
  const channelMembersRepository = {
    findOne: jest.fn(async () => ({ UserId: 5 })),
  };
  const workspacesService = {
    findWorkspaceByUrl: jest.fn().mockResolvedValue({ id: 1 }),
    assertRole: jest.fn().mockResolvedValue('admin'),
    assertMember: jest.fn().mockResolvedValue('member'),
  };
  const channelsService = { postChat: jest.fn(), editChat: jest.fn() };
  // 늦은 답 주소 (DB)
  let ticketRows: Record<string, any>[];
  const ticketsRepository = {
    delete: jest.fn(),
    save: jest.fn(async (v) => {
      const row = { id: ticketRows.length + 1, ...v };
      ticketRows.push(row);
      return row;
    }),
    findOne: jest.fn(async ({ where }) => {
      const row = ticketRows.find((r) => r.tokenHash === where.tokenHash);
      return row ? { ...row, App: command.App } : null;
    }),
    update: jest.fn(async (id, v) => {
      Object.assign(ticketRows.find((r) => r.id === id) as object, v);
    }),
  };
  let chat: Record<string, any> | null;
  const chatsRepository = { findOne: jest.fn(async () => chat) };
  const eventsGateway = { emitToWorkspace: jest.fn(), emitToUser: jest.fn() };
  const appEvents = { invalidate: jest.fn() };
  let service: AppsService;

  beforeEach(() => {
    jest.clearAllMocks();
    ticketRows = [];
    chat = null;
    service = new AppsService(
      appsRepository as never,
      commandsRepository as never,
      usersRepository as never,
      membersRepository as never,
      channelsRepository as never,
      channelMembersRepository as never,
      {} as never,
      ticketsRepository as never,
      chatsRepository as never,
      {} as never,
      workspacesService as never,
      channelsService as never,
      {} as never,
      eventsGateway as never,
      appEvents as never,
    );
  });

  it('앱을 만들면 봇 계정을 넣고, 토큰은 한 번만 돌려주며 해시만 저장한다', async () => {
    const created = await service.create('ws', { name: ' 배포봇 ' }, 5);
    expect(usersRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ nickname: '배포봇', bot: true }),
    );
    expect(membersRepository.save).toHaveBeenCalledWith({
      WorkspaceId: 1,
      UserId: 50,
    });
    expect(created.token).toMatch(/^shb-[0-9a-f]{48}$/);
    expect(saved.tokenHash).toBe(
      createHash('sha256').update(created.token).digest('hex'),
    );
    expect(JSON.stringify(saved)).not.toContain(created.token);
    await expect(service.authenticate(created.token)).resolves.toEqual(
      expect.objectContaining({ url: 'ws' }),
    );
    await expect(service.authenticate('shb-wrong')).resolves.toBeNull();
  });

  it('슐랙 기본 명령 이름은 쓸 수 없다', async () => {
    saved = { id: 4, WorkspaceId: 1, BotUserId: 50 };
    await expect(
      service.addCommand('ws', 4, { command: 'poll', url: 'https://a.b/c' }, 5),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('명령의 답: in_channel 은 앱 봇이 채널에 올리고, 그 밖은 나에게만 보여 준다', async () => {
    commandsRepository.findOne.mockResolvedValue(command);
    (postToApp as jest.Mock).mockResolvedValueOnce({
      status: 200,
      body: JSON.stringify({ text: '배포 시작!', response_type: 'in_channel' }),
    });
    await expect(
      service.runCommand(
        'ws',
        { command: 'deploy', text: 'prod', channel: '배포' },
        5,
      ),
    ).resolves.toEqual({ posted: true });
    expect(channelsService.postChat).toHaveBeenCalledWith(
      'ws',
      '배포',
      '배포 시작!',
      50,
    );
    const payload = (postToApp as jest.Mock).mock.calls[0][1];
    expect(payload).toMatchObject({
      type: 'slash_command',
      command: '/deploy',
      text: 'prod',
      user: { id: 5 },
      channel: '배포',
    });
    expect(payload.response_url).toMatch(/\/api\/apps\/respond\/[0-9a-f]+$/);

    (postToApp as jest.Mock).mockResolvedValueOnce({
      status: 200,
      body: '나만 봐요',
    });
    await expect(
      service.runCommand('ws', { command: 'deploy', channel: '배포' }, 5),
    ).resolves.toEqual({ ephemeral: { appName: '배포봇', text: '나만 봐요' } });

    (postToApp as jest.Mock).mockRejectedValueOnce(new Error('timeout'));
    const failed = await service.runCommand(
      'ws',
      { command: 'deploy', channel: '배포' },
      5,
    );
    expect(failed.ephemeral?.error).toBe(true);
  });

  it('늦은 답(response_url)은 5번까지만, 나에게만 보이는 답은 소켓으로 보낸다', async () => {
    commandsRepository.findOne.mockResolvedValue(command);
    (postToApp as jest.Mock).mockResolvedValueOnce({ status: 200, body: '' });
    await service.runCommand('ws', { command: 'deploy', channel: '배포' }, 5);
    const ticket = (postToApp as jest.Mock).mock.calls[0][1].response_url
      .split('/')
      .pop();
    for (let i = 0; i < 5; i += 1) {
      await service.respond(ticket, { text: `진행 ${i}` });
    }
    expect(eventsGateway.emitToUser).toHaveBeenCalledWith(
      'ws',
      5,
      'appEphemeral',
      expect.objectContaining({ text: '진행 0', channel: '배포' }),
    );
    await expect(
      service.respond(ticket, { text: '또' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.respond('nope', { text: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('채널 멤버가 아니면 그 채널에서 명령을 쓸 수 없다', async () => {
    commandsRepository.findOne.mockResolvedValue(command);
    channelMembersRepository.findOne.mockResolvedValueOnce(null);
    await expect(
      service.runCommand('ws', { command: 'deploy', channel: '배포' }, 6),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(postToApp).not.toHaveBeenCalled();
  });

  it('버튼을 누르면 앱에 보내고, replace_original 이면 원래 메시지를 바꾼다', async () => {
    saved = {
      id: 4,
      name: '배포봇',
      BotUserId: 50,
      WorkspaceId: 1,
      interactionUrl: 'https://app.example/act',
      eventUrl: null,
    };
    chat = {
      id: 9,
      UserId: 50,
      ChannelId: 2,
      content:
        'appmsg:{"t":"배포할까요?","b":[{"id":"ok","label":"승인","style":"primary","value":"v1"}]}',
      Channel: { WorkspaceId: 1, name: '배포', archived: false },
    };
    (postToApp as jest.Mock).mockResolvedValueOnce({
      status: 200,
      body: JSON.stringify({ replace_original: true, text: '✅ 승인됨' }),
    });
    await expect(
      service.runAction('ws', { chatId: 9, actionId: 'ok' }, 5),
    ).resolves.toEqual({ ok: true, replaced: true });
    const [target, payload] = (postToApp as jest.Mock).mock.calls[0];
    expect(target).toBe('https://app.example/act');
    expect(payload).toMatchObject({
      type: 'block_action',
      user: { id: 5 },
      channel: '배포',
      message_id: 9,
      message_text: '배포할까요?',
      action: { id: 'ok', value: 'v1' },
    });
    // 버튼 없이 바꾸면 그냥 글
    expect(channelsService.editChat).toHaveBeenCalledWith(
      'ws',
      '배포',
      9,
      '✅ 승인됨',
      50,
    );
  });

  it('나에게만 보이는 답은 소켓으로 보내고, 앱 메시지가 아니거나 없는 버튼이면 막는다', async () => {
    saved = {
      id: 4,
      name: '배포봇',
      BotUserId: 50,
      WorkspaceId: 1,
      interactionUrl: null,
      eventUrl: 'https://app.example/ev',
    };
    chat = {
      id: 9,
      UserId: 50,
      ChannelId: 2,
      content: 'appmsg:{"t":"x","b":[{"id":"ok","label":"승인"}]}',
      Channel: { WorkspaceId: 1, name: '배포', archived: false },
    };
    (postToApp as jest.Mock).mockResolvedValueOnce({
      status: 200,
      body: '{"text":"처리 중이에요"}',
    });
    await service.runAction('ws', { chatId: 9, actionId: 'ok' }, 5);
    // 버튼 주소가 없으면 이벤트 주소로
    expect((postToApp as jest.Mock).mock.calls[0][0]).toBe(
      'https://app.example/ev',
    );
    expect(eventsGateway.emitToUser).toHaveBeenCalledWith(
      'ws',
      5,
      'appEphemeral',
      expect.objectContaining({ text: '처리 중이에요', channel: '배포' }),
    );
    await expect(
      service.runAction('ws', { chatId: 9, actionId: 'nope' }, 5),
    ).rejects.toBeInstanceOf(BadRequestException);
    chat.content = '그냥 글';
    await expect(
      service.runAction('ws', { chatId: 9, actionId: 'ok' }, 5),
    ).rejects.toBeInstanceOf(BadRequestException);
    channelMembersRepository.findOne.mockResolvedValueOnce(null);
    await expect(
      service.runAction('ws', { chatId: 9, actionId: 'ok' }, 6),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
