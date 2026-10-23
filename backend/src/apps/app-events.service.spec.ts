import { AppEventsService } from './app-events.service';
import { postToApp } from './app-http';

jest.mock('./app-http', () => ({
  postToApp: jest.fn().mockResolvedValue({ status: 200, body: '' }),
}));

// 앱 이벤트: 앱 봇이 들어간 채널의 메시지만, 앱이 쓴 메시지는 빼고
describe('AppEventsService', () => {
  const app = {
    id: 3,
    BotUserId: 50,
    eventUrl: 'https://app.example/events',
    events: 'message,app_mention',
    signingSecret: 'sec',
  };
  const appsRepository = {
    find: jest.fn().mockResolvedValue([app]),
    count: jest.fn().mockResolvedValue(1),
    update: jest.fn().mockResolvedValue({}),
  };
  let inChannel: number[];
  const channelMembersRepository = {
    find: jest.fn(async () => inChannel.map((UserId) => ({ UserId }))),
  };
  const channel = { id: 9, name: '배포', WorkspaceId: 1 };
  let service: AppEventsService;
  const sent = () =>
    (postToApp as jest.Mock).mock.calls.map((c) => c[1].event.type);

  beforeEach(() => {
    jest.clearAllMocks();
    inChannel = [50];
    service = new AppEventsService(
      appsRepository as never,
      channelMembersRepository as never,
    );
  });

  it('앱이 들어간 채널의 새 메시지와 멘션을 보낸다', async () => {
    await service.channelMessage('ws', channel, {
      id: 1,
      content: '배포 부탁 @[배포봇](50)',
      UserId: 5,
      User: { id: 5, nickname: '문서왕' },
    });
    expect(sent()).toEqual(['message', 'app_mention']);
    const [url, payload, secret] = (postToApp as jest.Mock).mock.calls[0];
    expect(url).toBe('https://app.example/events');
    expect(secret).toBe('sec');
    expect(payload).toMatchObject({
      type: 'event_callback',
      app_id: 3,
      workspace: 'ws',
      event: { channel: '배포', user: { id: 5 }, message_id: 1 },
    });
  });

  it('앱이 없는 채널이나 앱이 쓴 메시지는 보내지 않는다', async () => {
    inChannel = [];
    await service.channelMessage('ws', channel, {
      id: 2,
      content: 'x',
      UserId: 5,
    });
    inChannel = [50];
    await service.channelMessage('ws', channel, {
      id: 3,
      content: 'x',
      UserId: 50,
    });
    expect(postToApp).not.toHaveBeenCalled();
  });

  it('앱 봇에게 온 DM 은 im 메시지로 보낸다', async () => {
    await service.directMessage('ws', 1, {
      id: 7,
      content: '안녕',
      SenderId: 5,
      ReceiverId: 50,
    });
    expect((postToApp as jest.Mock).mock.calls[0][1].event).toMatchObject({
      type: 'message',
      channel_type: 'im',
      text: '안녕',
    });
  });
});
