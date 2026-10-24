import Modal from '@components/Modal';
import { FormError, TextInput } from '@components/ModalForm/styles';
import { IChannel } from '@typings/db';
import { avatarUrl } from '@utils/avatar';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import dayjs from 'dayjs';
import { Bot, Copy, KeyRound, Plus, Trash2, X } from 'lucide-react';
import React, { FC, useState } from 'react';
import { toast } from 'react-toastify';
import useSWR from 'swr';
import { AppCard, Code, NewApp, Section, TokenBox } from './styles';

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
  bot: { id: number; nickname: string; email: string; avatarStyle?: string | null } | null;
  commands: { id: number; command: string; url: string; description: string | null; usageHint: string | null }[];
  channels: { name: string; private: boolean }[];
}

const EVENT_LABELS: Record<string, string> = {
  message: '새 메시지 (앱이 들어간 채널·앱에게 온 DM)',
  app_mention: '앱 멘션',
  reaction_added: '리액션',
};

const copy = (text: string) =>
  navigator.clipboard
    ?.writeText(text)
    .then(() => toast.info('복사했어요.', { position: 'bottom-center' }))
    .catch(() => undefined);

// 한 번만 보여 주는 토큰
const OnceToken: FC<{ token: string; onDone: () => void }> = ({ token, onDone }) => (
  <TokenBox role="status">
    <b>
      <KeyRound size={14} /> 봇 토큰 — 지금만 보여요. 안전한 곳에 저장하세요.
    </b>
    <code data-token>{token}</code>
    <div>
      <button type="button" onClick={() => copy(token)}>
        <Copy size={13} /> 복사
      </button>
      <button type="button" onClick={onDone}>
        저장했어요
      </button>
    </div>
  </TokenBox>
);

const AppDetail: FC<{ workspace: string; app: IApp; channels: IChannel[]; onChanged: () => void }> = ({
  workspace,
  app,
  channels,
  onChanged,
}) => {
  const base = `/api/workspaces/${workspace}/apps/${app.id}`;
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
  const sample = `curl -X POST ${window.location.origin}/api/apps/v1/chat.postMessage \\
  -H "Authorization: Bearer <봇 토큰>" -H "Content-Type: application/json" \\
  -d '{"channel": "${app.channels[0]?.name || '일반'}", "text": "안녕하세요!"}'`;

  return (
    <AppCard aria-label={`앱 ${app.name}`}>
      <header>
        {app.bot && <img src={avatarUrl(app.bot, 40)} alt="" />}
        <span className="who">
          <b>{app.name}</b>
          <small>{app.description || '설명 없음'}</small>
        </span>
        {confirmDelete ? (
          <>
            <span className="error">토큰과 명령을 더 쓸 수 없어요.</span>
            <button type="button" className="danger" onClick={() => run(axios.delete(base))}>
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
      </header>
      {error && <FormError role="alert">{error}</FormError>}

      <Section>
        <h4>봇 토큰 · 서명 비밀값</h4>
        {token ? (
          <OnceToken token={token} onDone={() => setToken('')} />
        ) : (
          <p className="row">
            <code>shb-…{app.tokenHint}</code>
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
              토큰 다시 만들기
            </button>
          </p>
        )}
        <p className="row">
          {secret ? <code data-secret>{secret}</code> : <span className="muted">서명 비밀값: 숨김</span>}
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
            {secret ? '복사' : '보기'}
          </button>
        </p>
        <p className="hint">
          우리가 앱에 보내는 요청에는 <code>X-Shlack-Signature</code> (v0=HMAC-SHA256(비밀값, "v0:시각:본문")) 와{' '}
          <code>X-Shlack-Request-Timestamp</code> 가 붙어요.
        </p>
      </Section>

      <Section>
        <h4>채널</h4>
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
          {!app.channels.length && (
            <span className="muted">아직 어느 채널에도 없어요. 넣은 채널에만 글을 쓸 수 있어요.</span>
          )}
        </div>
        <p className="row">
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
            disabled={!channel}
            onClick={() => run(axios.post(`${base}/channels`, { channel }).then(() => setChannel('')))}
          >
            채널에 넣기
          </button>
        </p>
      </Section>

      <Section>
        <h4>이벤트 받기</h4>
        <p className="row">
          <TextInput
            value={eventUrl}
            onChange={(e) => setEventUrl(e.target.value)}
            placeholder="https://내-앱/shlack/events"
            aria-label="이벤트 주소"
          />
        </p>
        <p className="row">
          <TextInput
            value={interactionUrl}
            onChange={(e) => setInteractionUrl(e.target.value)}
            placeholder="버튼 누름을 받을 주소 (비우면 이벤트 주소로)"
            aria-label="버튼 주소"
          />
        </p>
        <div className="checks">
          {Object.entries(EVENT_LABELS).map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={events.includes(key)}
                onChange={(e) => setEvents((v) => (e.target.checked ? [...v, key] : v.filter((x) => x !== key)))}
              />
              {label}
            </label>
          ))}
        </div>
        <p className="row">
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
          {app.lastEventAt && (
            <span className={app.lastEventError ? 'error' : 'muted'}>
              마지막 전달 {dayjs(app.lastEventAt).format('M/D HH:mm')} ·{' '}
              {app.lastEventError ? `실패: ${app.lastEventError}` : '성공'}
            </span>
          )}
        </p>
        <p className="hint">
          저장할 때 <code>{'{"type":"url_verification","challenge":"…"}'}</code> 를 보내요. challenge 를 그대로 돌려주면
          연결돼요.
        </p>
      </Section>

      <Section>
        <h4>슬래시 명령</h4>
        <ul className="commands">
          {app.commands.map((c) => (
            <li key={c.id}>
              <code>
                /{c.command}
                {c.usageHint ? ` ${c.usageHint}` : ''}
              </code>
              <span className="muted">{c.description}</span>
              <span className="url">{c.url}</span>
              <button
                type="button"
                aria-label={`/${c.command} 지우기`}
                onClick={() => run(axios.delete(`${base}/commands/${c.id}`))}
              >
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
        <div className="command-form">
          <TextInput
            value={command.command}
            onChange={(e) => setCommand({ ...command, command: e.target.value.replace(/^\//, '').toLowerCase() })}
            placeholder="deploy"
            aria-label="명령 이름"
          />
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
          <button
            type="button"
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
      </Section>

      <Section>
        <h4>앱 API 써 보기</h4>
        <Code>{sample}</Code>
        <p className="hint">
          메시지 고치기·지우기(chat.update, chat.delete), 리액션(reactions.add), 채널·사람 목록도 있어요. 자세한 건 API
          문서 (/api) 의 "APPS API" 를 보세요.
        </p>
      </Section>
    </AppCard>
  );
};

// 외부 앱 연동 (워크스페이스 관리자): 앱 만들기, 봇 토큰, 채널, 이벤트, 슬래시 명령
const AppsModal: FC<{ show: boolean; workspace: string; onCloseModal: () => void }> = ({
  show,
  workspace,
  onCloseModal,
}) => {
  const { data: apps, error, mutate } = useSWR<IApp[]>(show ? `/api/workspaces/${workspace}/apps` : null, fetcher);
  const { data: channels } = useSWR<IChannel[]>(show ? `/api/workspaces/${workspace}/channels` : null, fetcher);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [created, setCreated] = useState<{ name: string; token: string } | null>(null);
  const [formError, setFormError] = useState('');

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    axios
      .post<IApp & { token: string }>(`/api/workspaces/${workspace}/apps`, { name, description })
      .then(({ data }) => {
        setCreated({ name: data.name, token: data.token });
        setName('');
        setDescription('');
        setFormError('');
        mutate();
      })
      .catch((err) => setFormError(getErrorMessage(err)));
  };

  return (
    <Modal
      show={show}
      onCloseModal={onCloseModal}
      title="앱 연동"
      description="외부 서비스가 봇으로 글을 쓰고, 채팅 이벤트를 받고, 슬래시 명령을 처리하게 해요."
      width={720}
    >
      {error && <FormError role="alert">{getErrorMessage(error)}</FormError>}
      <NewApp onSubmit={create}>
        <Bot size={18} />
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
        <button type="submit" className="primary" disabled={!name.trim()}>
          새 앱 만들기
        </button>
      </NewApp>
      {formError && <FormError role="alert">{formError}</FormError>}
      {created && (
        <>
          <p className="hint">'{created.name}' 앱을 만들었어요.</p>
          <OnceToken token={created.token} onDone={() => setCreated(null)} />
        </>
      )}
      {apps && !apps.length && <p className="hint">아직 앱이 없어요. 위에서 만들어 보세요.</p>}
      {(apps || []).map((app) => (
        <AppDetail key={app.id} workspace={workspace} app={app} channels={channels || []} onChanged={() => mutate()} />
      ))}
    </Modal>
  );
};

export default AppsModal;
