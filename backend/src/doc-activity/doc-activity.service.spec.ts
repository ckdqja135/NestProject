import * as Y from 'yjs';
import { DocActivityService } from './doc-activity.service';

// 채널 탭 알림: 알림을 켠 탭의 채널에만, 수정은 30분에 한 번, 데이터베이스는 새 항목·상태 변경
describe('DocActivityService', () => {
  let tabs: Record<string, any>[];
  const tabsRepository = { find: jest.fn(async () => tabs) };
  const docsRepository = {
    findOne: jest.fn(async () => ({ id: 7, title: '회의록', type: 'doc' })),
  };
  const usersRepository = {
    findOne: jest.fn(async () => ({ id: 5, nickname: '문서왕' })),
  };
  const channelsService = { postBotMessage: jest.fn().mockResolvedValue({}) };
  let service: DocActivityService;
  const posted = () =>
    channelsService.postBotMessage.mock.calls.map((c) => [c[0], c[1]]);

  beforeEach(() => {
    jest.clearAllMocks();
    tabs = [
      { ChannelId: 3, DocId: 7, notify: true, Channel: { archived: false } },
    ];
    service = new DocActivityService(
      tabsRepository as never,
      docsRepository as never,
      usersRepository as never,
      channelsService as never,
    );
  });

  it('댓글은 알림을 켠 채널에 슐랙봇으로 알린다', async () => {
    await service.comment(7, 5, '이 부분 확인 부탁해요');
    expect(channelsService.postBotMessage).toHaveBeenCalledWith(
      3,
      '💬 문서왕 님이 **회의록** 에 댓글을 달았어요: “이 부분 확인 부탁해요”',
      '슐랙봇',
    );
    tabs = [];
    await service.comment(7, 5, '또');
    expect(channelsService.postBotMessage).toHaveBeenCalledTimes(1);
  });

  it('수정은 같은 채널에 30분에 한 번만 알린다', async () => {
    await service.edited(7, 5);
    await service.edited(7, 5);
    expect(posted()).toEqual([
      [3, '📝 문서왕 님이 **회의록** 을(를) 고쳤어요.'],
    ]);
  });

  it('보관된 채널에는 알리지 않는다', async () => {
    tabs[0].Channel.archived = true;
    await service.comment(7, 5, 'x');
    expect(channelsService.postBotMessage).not.toHaveBeenCalled();
  });

  it('데이터베이스는 지난 저장과 비교해 새 항목과 상태 변경만 알린다', async () => {
    docsRepository.findOne.mockResolvedValue({
      id: 7,
      title: '할 일',
      type: 'database',
    });
    const ydoc = new Y.Doc();
    const props = ydoc.getArray<Y.Map<unknown>>('properties');
    const prop = (v: Record<string, unknown>) => {
      const m = new Y.Map<unknown>();
      Object.entries(v).forEach(([k, val]) => m.set(k, val));
      return m;
    };
    props.push([
      prop({ id: 't', name: '이름', type: 'title' }),
      prop({
        id: 's',
        name: '상태',
        type: 'status',
        options: [
          { id: 'a', name: '할 일' },
          { id: 'b', name: '완료' },
        ],
      }),
    ]);
    const rows = ydoc.getMap<Y.Map<unknown>>('rows');
    rows.set('r1', prop({ t: '기획서 쓰기', s: 'a' }));
    // 처음 저장은 기준만 잡는다
    await service.databaseSaved(7, ydoc, 5);
    expect(channelsService.postBotMessage).not.toHaveBeenCalled();
    rows.get('r1')!.set('s', 'b');
    rows.set('r2', prop({ t: '발표 준비', s: 'a' }));
    await service.databaseSaved(7, ydoc, 5);
    expect(posted()).toEqual([
      [
        3,
        '🗂 문서왕 님이 **할 일** 을(를) 바꿨어요\n🔄 기획서 쓰기: 할 일 → 완료\n➕ 새 항목: 발표 준비 (할 일)',
      ],
    ]);
    // 바뀐 게 없으면 알리지 않는다
    await service.databaseSaved(7, ydoc, 5);
    expect(channelsService.postBotMessage).toHaveBeenCalledTimes(1);
    // 데이터베이스는 '고쳤어요' 대신 항목 알림만
    await service.edited(7, 5);
    expect(channelsService.postBotMessage).toHaveBeenCalledTimes(1);
  });
});
