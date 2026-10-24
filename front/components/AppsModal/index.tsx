import Modal from '@components/Modal';
import { FormError, TextInput } from '@components/ModalForm/styles';
import { IChannel } from '@typings/db';
import { avatarUrl } from '@utils/avatar';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import dayjs from 'dayjs';
import {
  Bot,
  Check,
  Code2,
  Copy,
  Eye,
  Hash,
  KeyRound,
  MousePointerClick,
  Plus,
  RefreshCw,
  Slash,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import React, { FC, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import useSWR from 'swr';
import { AppList, Card, Code, Detail, Layout, NewPane, Pill, Steps, Tabs, TokenBox } from './styles';

interface IApp {
  id: number;
  name: string;
  description: string | null;
  tokenHint: string;
  eventUrl: string | null;
  interactionUrl: string | null;
  events: string[];
  lastEventAt: string | null;
  lastEventError: string | null;
  createdAt?: string;
  bot: { id: number; nickname: string; email: string; avatarStyle?: string | null } | null;
  commands: { id: number; command: string; url: string; description: string | null; usageHint: string | null }[];
  channels: { name: string; private: boolean }[];
}

const EVENTS: { key: string; label: string; hint: string }[] = [
  { key: 'message', label: '새 메시지', hint: '앱이 들어간 채널과 앱에게 온 DM' },
  { key: 'app_mention', label: '앱 멘션', hint: '누군가 @앱 이름 으로 불렀을 때' },
  { key: 'reaction_added', label: '리액션', hint: '앱이 들어간 채널의 메시지에 리액션' },
];

type TabKey = 'overview' | 'channels' | 'events' | 'commands' | 'guide';
const TABS: { key: TabKey; label: string; Icon: typeof Bot }[] = [
  { key: 'overview', label: '개요', Icon: Sparkles },
  { key: 'channels', label: '채널', Icon: Hash },
  { key: 'events', label: '이벤트·버튼', Icon: Zap },
  { key: 'commands', label: '슬래시 명령', Icon: Slash },
  { key: 'guide', label: '개발 가이드', Icon: Code2 },
];

const copy = (text: string) =>
  navigator.clipboard
    ?.writeText(text)
    .then(() => toast.info('복사했어요.', { position: 'bottom-center' }))
    .catch(() => undefined);

// 앱 상태: 이벤트 전달 오류 > 이벤트 연결 > 토큰만
const statusOf = (app: IApp) =>
  app.lastEventError
    ? { tone: 'error', label: '전달 오류' }
    : app.eventUrl
    ? { tone: 'ok', label: '이벤트 연결됨' }
    : { tone: 'idle', label: '토큰으로 사용' };

// 한 번만 보여 주는 토큰
const OnceToken: FC<{ token: string; onDone: () => void }> = ({ token, onDone }) => (
  <TokenBox role="status">
    <b>
      <KeyRound size={15} /> 봇 토큰이에요. 지금 한 번만 보여요.
    </b>
    <small>창을 닫으면 다시 볼 수 없어요. 잃어버리면 "토큰 다시 만들기"로 새로 받으세요.</small>
    <code data-token>{token}</code>
    <div>
      <button type="button" className="primary" onClick={() => copy(token)}>
        <Copy size={13} /> 복사
      </button>
      <button type="button" onClick={onDone}>
        저장했어요
      </button>
    </div>
  </TokenBox>
);

interface DetailProps {
  workspace: string;
  app: IApp;
  channels: IChannel[];
  // 막 만든 앱의 토큰 (한 번만)
  freshToken: string | null;
  onTokenSeen: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}

const AppDetail: FC<DetailProps> = ({ workspace, app, channels, freshToken, onTokenSeen, onChanged, onDeleted }) => {
  const base = `/api/workspaces/${workspace}/apps/${app.id}`;
  const [tab, setTab] = useState<TabKey>('overview');
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [secret, setSecret] = useState('');
  const [eventUrl, setEventUrl] = useState(app.eventUrl || '');
  const [interactionUrl, setInteractionUrl] = useState(app.interactionUrl || '');
  const [events, setEvents] = useState<string[]>(app.events);
  const [savingEvents, setSavingEvents] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [channel, setChannel] = useState('');
  const [command, setCommand] = useState({ command: '', url: '', description: '', usageHint: '' });
  const run = (request: Promise<unknown>) =>
    request
      .then(() => {
        setError('');
        onChanged();
      })
      .catch((err) => setError(getErrorMessage(err)));
  const candidates = channels.filter((c) => !c.archived && !app.channels.some((a) => a.name === c.name));
  const status = statusOf(app);
  const steps = [
    { done: true, label: '앱 만들기' },
    { done: app.channels.length > 0, label: '채널에 넣기', tab: 'channels' as TabKey },
    { done: !!app.eventUrl, label: '이벤트 받기', tab: 'events' as TabKey },
    { done: app.commands.length > 0, label: '슬래시 명령', tab: 'commands' as TabKey },
  ];
  const origin = window.location.origin;
  const firstChannel = app.channels[0]?.name || '일반';

  return (
    <Detail aria-label={`앱 ${app.name}`}>
      <header className="hero">
        {app.bot && <img src={avatarUrl(app.bot, 96)} alt="" />}
        <div className="who">
          <h3>
            {app.name} <Pill className="bot">앱</Pill>
          </h3>
          <p>{app.description || '설명이 없어요'}</p>
          <div className="meta">
            <Pill className={status.tone}>{status.label}</Pill>
            <span>
              <Hash size={12} /> 채널 {app.channels.length}
            </span>
            <span>
              <Slash size={12} /> 명령 {app.commands.length}
            </span>
            {app.createdAt && <span>{dayjs(app.createdAt).format('YYYY.M.D')} 만듦</span>}
          </div>
        </div>
        <div className="danger-zone">
          {confirmDelete ? (
            <>
              <button type="button" className="danger solid" onClick={() => run(axios.delete(base)).then(onDeleted)}>
                정말 지우기
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)}>
                취소
              </button>
            </>
          ) : (
            <button type="button" className="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={13} /> 지우기
            </button>
          )}
        </div>
      </header>
      {confirmDelete && <p className="warn">지우면 토큰과 명령을 더 쓸 수 없어요. 앱이 쓴 메시지는 남아요.</p>}

      <Tabs role="tablist" aria-label="앱 설정">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'on' : undefined}
            onClick={() => setTab(key)}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </Tabs>
      {/* 머리와 탭은 그대로 두고 아래만 스크롤 */}
      <div className="panel">
        {error && <FormError role="alert">{error}</FormError>}

        {tab === 'overview' && (
          <>
            {(freshToken || token) && (
              <OnceToken
                token={freshToken || token}
                onDone={() => {
                  setToken('');
                  onTokenSeen();
                }}
              />
            )}
            <Card>
              <h4>설정 진행</h4>
              <Steps>
                {steps.map((step, i) => (
                  <li key={step.label} className={step.done ? 'done' : undefined}>
                    <span className="dot">{step.done ? <Check size={12} /> : i + 1}</span>
                    {step.tab && !step.done ? (
                      <button type="button" onClick={() => setTab(step.tab!)}>
                        {step.label}
                      </button>
                    ) : (
                      <span>{step.label}</span>
                    )}
                  </li>
                ))}
              </Steps>
            </Card>
            <Card>
              <h4>
                <KeyRound size={14} /> 봇 토큰
              </h4>
              <p className="hint">외부 서비스가 이 토큰으로 앱 API 를 불러요. 비밀번호처럼 다뤄 주세요.</p>
              <div className="row">
                <code className="mono">shb-••••••••{app.tokenHint}</code>
                <button
                  type="button"
                  onClick={() =>
                    axios
                      .post<{ token: string }>(`${base}/token`)
                      .then(({ data }) => {
                        setToken(data.token);
                        onChanged();
                      })
                      .catch((err) => setError(getErrorMessage(err)))
                  }
                >
                  <RefreshCw size={13} /> 토큰 다시 만들기
                </button>
              </div>
            </Card>
            <Card>
              <h4>
                <Eye size={14} /> 서명 비밀값
              </h4>
              <p className="hint">
                우리가 앱에 보내는 요청에는 <code>X-Shlack-Signature</code> 가 붙어요. 이 값으로 진짜 슐랙 요청인지
                확인하세요.
              </p>
              <div className="row">
                {secret ? (
                  <code className="mono" data-secret>
                    {secret}
                  </code>
                ) : (
                  <code className="mono">••••••••••••••••</code>
                )}
                <button
                  type="button"
                  onClick={() =>
                    secret
                      ? copy(secret)
                      : axios
                          .get<{ signingSecret: string }>(`${base}/secret`)
                          .then(({ data }) => setSecret(data.signingSecret))
                          .catch((err) => setError(getErrorMessage(err)))
                  }
                >
                  {secret ? (
                    <>
                      <Copy size={13} /> 복사
                    </>
                  ) : (
                    <>
                      <Eye size={13} /> 보기
                    </>
                  )}
                </button>
              </div>
            </Card>
          </>
        )}

        {tab === 'channels' && (
          <Card>
            <h4>
              <Hash size={14} /> 앱이 들어간 채널
            </h4>
            <p className="hint">앱은 넣어 준 채널에만 글을 쓰고, 그 채널의 이벤트만 받아요.</p>
            <div className="chips">
              {app.channels.map((c) => (
                <span key={c.name} className="chip">
                  {c.private ? '🔒' : '#'}
                  {c.name}
                  <button
                    type="button"
                    aria-label={`${c.name} 에서 빼기`}
                    onClick={() => run(axios.delete(`${base}/channels/${encodeURIComponent(c.name)}`))}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
              {!app.channels.length && <span className="empty">아직 어느 채널에도 없어요.</span>}
            </div>
            <div className="row">
              <select
                className="select"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                aria-label="넣을 채널"
              >
                <option value="">채널 고르기</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.private ? '🔒 ' : '# '}
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="primary"
                disabled={!channel}
                onClick={() => run(axios.post(`${base}/channels`, { channel }).then(() => setChannel('')))}
              >
                <Plus size={13} /> 채널에 넣기
              </button>
            </div>
          </Card>
        )}

        {tab === 'events' && (
          <>
            <Card>
              <h4>
                <Zap size={14} /> 이벤트 받기
              </h4>
              <p className="hint">
                저장할 때 <code>{'{"type":"url_verification","challenge":"…"}'}</code> 를 보내요. challenge 를 그대로
                돌려주면 연결돼요.
              </p>
              <TextInput
                value={eventUrl}
                onChange={(e) => setEventUrl(e.target.value)}
                placeholder="https://내-앱/shlack/events"
                aria-label="이벤트 주소"
              />
              <div className="toggles">
                {EVENTS.map(({ key, label, hint }) => (
                  <label key={key} className={events.includes(key) ? 'on' : undefined}>
                    <input
                      type="checkbox"
                      checked={events.includes(key)}
                      onChange={(e) => setEvents((v) => (e.target.checked ? [...v, key] : v.filter((x) => x !== key)))}
                    />
                    <span>
                      <b>{label}</b>
                      <small>{hint}</small>
                    </span>
                  </label>
                ))}
              </div>
              {app.lastEventAt && (
                <p className={`delivery ${app.lastEventError ? 'error' : 'ok'}`}>
                  마지막 전달 {dayjs(app.lastEventAt).format('M/D HH:mm')} ·{' '}
                  {app.lastEventError ? `실패: ${app.lastEventError}` : '성공'}
                </p>
              )}
            </Card>
            <Card>
              <h4>
                <MousePointerClick size={14} /> 메시지 버튼
              </h4>
              <p className="hint">앱이 보낸 메시지의 버튼을 누르면 이 주소로 보내요. 비우면 이벤트 주소로 보내요.</p>
              <TextInput
                value={interactionUrl}
                onChange={(e) => setInteractionUrl(e.target.value)}
                placeholder="https://내-앱/shlack/actions"
                aria-label="버튼 주소"
              />
            </Card>
            <div className="save-row">
              <button
                type="button"
                className="primary"
                disabled={savingEvents}
                onClick={() => {
                  setSavingEvents(true);
                  run(
                    axios.patch(base, {
                      eventUrl: eventUrl.trim() || null,
                      interactionUrl: interactionUrl.trim() || null,
                      events,
                    }),
                  ).finally(() => setSavingEvents(false));
                }}
              >
                {savingEvents ? '주소 확인 중…' : '이벤트 설정 저장'}
              </button>
            </div>
          </>
        )}

        {tab === 'commands' && (
          <Card>
            <h4>
              <Slash size={14} /> 슬래시 명령
            </h4>
            <p className="hint">
              입력창에 /명령 을 치면 이 주소로 요청이 가요. 앱의 답은 채널에 올리거나 나에게만 보여 줄 수 있어요.
            </p>
            <ul className="commands">
              {app.commands.map((c) => (
                <li key={c.id}>
                  <code className="cmd">
                    /{c.command}
                    {c.usageHint ? ` ${c.usageHint}` : ''}
                  </code>
                  <span className="desc">
                    {c.description || '설명 없음'}
                    <small>{c.url}</small>
                  </span>
                  <button
                    type="button"
                    className="icon"
                    aria-label={`/${c.command} 지우기`}
                    onClick={() => run(axios.delete(`${base}/commands/${c.id}`))}
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
              {!app.commands.length && <li className="empty">아직 명령이 없어요.</li>}
            </ul>
            <div className="command-form">
              <div className="prefixed">
                <span>/</span>
                <input
                  value={command.command}
                  onChange={(e) => setCommand({ ...command, command: e.target.value.replace(/^\//, '').toLowerCase() })}
                  placeholder="deploy"
                  aria-label="명령 이름"
                />
              </div>
              <TextInput
                value={command.url}
                onChange={(e) => setCommand({ ...command, url: e.target.value })}
                placeholder="https://내-앱/shlack/commands"
                aria-label="명령 주소"
              />
              <TextInput
                value={command.description}
                onChange={(e) => setCommand({ ...command, description: e.target.value })}
                placeholder="설명 (예: 서버에 배포)"
                aria-label="명령 설명"
              />
              <TextInput
                value={command.usageHint}
                onChange={(e) => setCommand({ ...command, usageHint: e.target.value })}
                placeholder="입력 예 (예: 서버이름)"
                aria-label="명령 입력 예"
              />
            </div>
            <div className="save-row">
              <button
                type="button"
                className="primary"
                disabled={!command.command || !command.url}
                onClick={() =>
                  run(
                    axios
                      .post(`${base}/commands`, command)
                      .then(() => setCommand({ command: '', url: '', description: '', usageHint: '' })),
                  )
                }
              >
                <Plus size={13} /> 명령 추가
              </button>
            </div>
          </Card>
        )}

        {tab === 'guide' && (
          <>
            <Card>
              <h4>메시지 보내기</h4>
              <Code>{`curl -X POST ${origin}/api/apps/v1/chat.postMessage \\
  -H "Authorization: Bearer <봇 토큰>" \\
  -H "Content-Type: application/json" \\
  -d '{"channel": "${firstChannel}", "text": "배포가 끝났어요 🚀"}'`}</Code>
            </Card>
            <Card>
              <h4>버튼 달기</h4>
              <Code>{`{"channel": "${firstChannel}", "text": "배포할까요?",
 "buttons": [{"id": "ok", "label": "승인", "style": "primary"},
             {"id": "no", "label": "취소", "style": "danger"}]}`}</Code>
              <p className="hint">
                버튼을 누르면 <code>block_action</code> 요청이 가요.{' '}
                <code>{'{"replace_original": true, "text": "✅ 승인됨"}'}</code> 로 답하면 메시지가 바뀌어요.
              </p>
            </Card>
            <Card>
              <h4>서명 확인 (Node.js)</h4>
              <Code>{`const base = \`v0:\${req.headers['x-shlack-request-timestamp']}:\${rawBody}\`;
const mine = 'v0=' + crypto.createHmac('sha256', SIGNING_SECRET)
  .update(base).digest('hex');
if (mine !== req.headers['x-shlack-signature']) return res.status(401).end();`}</Code>
              <p className="hint">
                고치기·지우기(chat.update, chat.delete), 리액션(reactions.add), 채널·사람 목록은 API 문서(/api)의 "APPS
                API" 에 있어요.
              </p>
            </Card>
          </>
        )}
      </div>
    </Detail>
  );
};

// 새 앱 만들기 (오른쪽 칸)
const NewApp: FC<{ workspace: string; onCreated: (app: IApp & { token: string }) => void }> = ({
  workspace,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || pending) return;
    setPending(true);
    axios
      .post<IApp & { token: string }>(`/api/workspaces/${workspace}/apps`, { name, description })
      .then(({ data }) => {
        setName('');
        setDescription('');
        setError('');
        onCreated(data);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setPending(false));
  };
  return (
    <NewPane onSubmit={create}>
      <div className="art" aria-hidden="true">
        <Bot size={34} />
      </div>
      <h3>새 앱 만들기</h3>
      <p>앱마다 전용 봇 계정이 생겨요. 외부 서비스가 이 봇으로 채널에 글을 쓰고, 채팅에 반응하고, 명령을 처리해요.</p>
      <ul className="features">
        <li>
          <Hash size={14} /> 채널·DM 에 메시지와 버튼 보내기
        </li>
        <li>
          <Zap size={14} /> 새 메시지·멘션·리액션 이벤트 받기
        </li>
        <li>
          <Slash size={14} /> /명령 으로 외부 작업 실행
        </li>
      </ul>
      {error && <FormError role="alert">{error}</FormError>}
      <TextInput
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={30}
        placeholder="앱 이름 (예: 배포 알림)"
        aria-label="앱 이름"
      />
      <TextInput
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={200}
        placeholder="설명 (선택)"
        aria-label="앱 설명"
      />
      <button type="submit" className="primary" disabled={!name.trim() || pending}>
        <Plus size={15} /> {pending ? '만드는 중…' : '새 앱 만들기'}
      </button>
    </NewPane>
  );
};

// 외부 앱 연동 (워크스페이스 관리자): 왼쪽 앱 목록, 오른쪽 앱 상세 또는 새 앱 만들기
const AppsModal: FC<{ show: boolean; workspace: string; onCloseModal: () => void }> = ({
  show,
  workspace,
  onCloseModal,
}) => {
  const { data: apps, error, mutate } = useSWR<IApp[]>(show ? `/api/workspaces/${workspace}/apps` : null, fetcher);
  const { data: channels } = useSWR<IChannel[]>(show ? `/api/workspaces/${workspace}/channels` : null, fetcher);
  const [selected, setSelected] = useState<number | 'new' | null>(null);
  const [fresh, setFresh] = useState<{ id: number; token: string } | null>(null);
  // 처음 열면 첫 앱 (없으면 새 앱 만들기)
  useEffect(() => {
    if (!apps) return;
    if (selected === null || (selected !== 'new' && !apps.some((a) => a.id === selected))) {
      setSelected(apps[0]?.id ?? 'new');
    }
  }, [apps, selected]);
  const current = typeof selected === 'number' ? apps?.find((a) => a.id === selected) : undefined;

  return (
    <Modal
      show={show}
      onCloseModal={onCloseModal}
      title="앱 연동"
      description="외부 서비스가 봇으로 글을 쓰고, 채팅 이벤트를 받고, 슬래시 명령을 처리하게 해요."
      icon={<Bot size={22} />}
      width={940}
    >
      {error && <FormError role="alert">{getErrorMessage(error)}</FormError>}
      <Layout>
        <AppList aria-label="앱 목록">
          <button
            type="button"
            className={`new${selected === 'new' ? ' on' : ''}`}
            onClick={() => setSelected('new')}
            aria-pressed={selected === 'new'}
          >
            <Plus size={15} /> 새 앱
          </button>
          {(apps || []).map((app) => {
            const status = statusOf(app);
            return (
              <button
                key={app.id}
                type="button"
                className={selected === app.id ? 'on' : undefined}
                onClick={() => setSelected(app.id)}
                aria-pressed={selected === app.id}
              >
                {app.bot && <img src={avatarUrl(app.bot, 64)} alt="" />}
                <span className="text">
                  <b>{app.name}</b>
                  <small>
                    <i className={`dot ${status.tone}`} /> {status.label}
                  </small>
                </span>
              </button>
            );
          })}
          {apps && !apps.length && <p className="empty">아직 앱이 없어요.</p>}
        </AppList>
        {selected === 'new' ? (
          <NewApp
            workspace={workspace}
            onCreated={(app) => {
              setFresh({ id: app.id, token: app.token });
              // 목록에 새 앱이 들어온 뒤 고른다 (먼저 고르면 '없는 앱'으로 보고 첫 앱으로 돌아간다)
              mutate().then(() => setSelected(app.id));
            }}
          />
        ) : current ? (
          <AppDetail
            key={current.id}
            workspace={workspace}
            app={current}
            channels={channels || []}
            freshToken={fresh?.id === current.id ? fresh.token : null}
            onTokenSeen={() => setFresh(null)}
            onChanged={() => mutate()}
            onDeleted={() => {
              setFresh(null);
              setSelected(null);
              mutate();
            }}
          />
        ) : (
          <div />
        )}
      </Layout>
    </Modal>
  );
};

export default AppsModal;
