import Modal from '@components/Modal';
import useMyRole from '@hooks/useMyRole';
import { ChoiceList, Field, FormError, TextInput } from '@components/ModalForm/styles';
import { IChannel, IDoc, IUser } from '@typings/db';
import { avatarUrl } from '@utils/avatar';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import React, { FC, useEffect, useState } from 'react';
import { Building2, Lock, Send, Share2, UserPlus } from 'lucide-react';
import { toast } from 'react-toastify';
import useSWR from 'swr';
import { docsBase } from './api';
import { ShareList } from './styles';

interface Props {
  show: boolean;
  workspace: string;
  doc: IDoc;
  me: IUser;
  onCloseModal: () => void;
  onChanged: () => void;
}

const ROLE_LABEL = { view: '보기만', edit: '고칠 수 있음' } as const;

interface AccessRequest {
  id: number;
  UserId: number;
  role: 'view' | 'edit';
  message: string | null;
  requestedAt: string;
  User: IUser;
}

// 문서 공유: 일반 액세스 (초대한 사람만·워크스페이스 멤버 모두 + 보기/편집) + 사람별 보기/편집 권한 + 접근 요청
const ShareDocModal: FC<Props> = ({ show, workspace, doc, me, onCloseModal, onChanged }) => {
  // 게스트는 워크스페이스 전체에 공개할 수 없다
  const isGuest = useMyRole(workspace) === 'guest';
  const { data: members } = useSWR<IUser[]>(show ? `/api/workspaces/${workspace}/members` : null, fetcher);
  const { data: channels } = useSWR<IChannel[]>(show ? `/api/workspaces/${workspace}/channels` : null, fetcher);
  const { data: requests, mutate: mutateRequests } = useSWR<AccessRequest[]>(
    show && doc.canManage ? `${docsBase(workspace)}/docs/${doc.id}/access-requests` : null,
    fetcher,
  );
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  // 채널에 보내기 (문서 링크를 메시지로)
  const [sendTo, setSendTo] = useState('');
  const [note, setNote] = useState('');
  const [grant, setGrant] = useState(true);
  const [sending, setSending] = useState(false);
  const base = `${docsBase(workspace)}/docs/${doc.id}`;
  const manage = doc.canManage;
  useEffect(() => {
    if (show) {
      setQuery('');
      setError('');
      setSendTo('');
      setNote('');
      setGrant(true);
    }
  }, [show]);

  const run = (request: Promise<unknown>) => request.then(onChanged).catch((err) => setError(getErrorMessage(err)));
  const decide = (request: AccessRequest, decision: 'approve' | 'deny', role?: 'view' | 'edit') =>
    run(
      axios.post(`${base}/access-requests/${request.id}`, { decision, role }).then(() => {
        mutateRequests();
        toast.info(
          decision === 'approve'
            ? `${request.User.nickname} 님에게 ${ROLE_LABEL[role || request.role]} 권한을 줬어요.`
            : `${request.User.nickname} 님의 요청을 거절했어요.`,
          { position: 'bottom-center' },
        );
      }),
    );

  const shared = new Set(doc.Shares.map((s) => s.UserId));
  const keyword = query.trim().toLowerCase();
  const candidates = keyword
    ? (members || []).filter(
        (m) =>
          m.id !== doc.OwnerId &&
          !m.bot &&
          !shared.has(m.id) &&
          (m.nickname.toLowerCase().includes(keyword) || m.email.toLowerCase().includes(keyword)),
      )
    : [];
  const isWiki = doc.type === 'wiki';
  const link = `${window.location.origin}/workspace/${workspace}/docs/d/${doc.id}`;
  const writable = (channels || []).filter((c) => !c.archived);
  // 비공개 문서를 채널에 보내면 채널 사람들은 볼 수 없으니, 보기 권한도 같이 줄지 묻는다
  const canGrant = manage && doc.visibility === 'private' && !isWiki;

  const sendToChannel = async () => {
    if (!sendTo || sending) return;
    setSending(true);
    setError('');
    try {
      if (canGrant && grant) {
        await axios.put(`${base}/channel-share`, { channel: sendTo });
      }
      await axios.post(`/api/workspaces/${workspace}/channels/${encodeURIComponent(sendTo)}/chats`, {
        content: [note.trim(), link].filter(Boolean).join('\n'),
      });
      toast.success(`#${sendTo} 에 문서를 보냈어요.`, { position: 'bottom-center' });
      setNote('');
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal show={show} onCloseModal={onCloseModal} title={`'${doc.title}' 공유`} icon={<Share2 size={20} />}>
      {error && <FormError role="alert">{error}</FormError>}
      {manage && !!requests?.length && (
        <Field>
          <label>
            <UserPlus size={14} style={{ verticalAlign: '-2px' }} /> 접근 요청 {requests.length}건
          </label>
          <ShareList aria-label="접근 요청">
            {requests.map((r) => (
              <li key={r.id}>
                <img src={avatarUrl(r.User, 28)} alt="" />
                <span className="who">
                  {r.User.nickname} · {ROLE_LABEL[r.role]} 요청
                  <small>{r.message ? `“${r.message}”` : r.User.email}</small>
                </span>
                <button type="button" onClick={() => decide(r, 'approve', 'view')}>
                  보기 허락
                </button>
                <button type="button" className="primary" onClick={() => decide(r, 'approve', 'edit')}>
                  편집 허락
                </button>
                <button type="button" onClick={() => decide(r, 'deny')}>
                  거절
                </button>
              </li>
            ))}
          </ShareList>
        </Field>
      )}

      <Field>
        <label>일반 액세스</label>
        <ChoiceList>
          {(
            [
              [
                'private',
                <Lock key="l" size={14} />,
                '초대한 사람만',
                '아래에 추가한 사람만 열 수 있어요. 링크만으로는 열 수 없어요.',
              ],
              [
                'workspace',
                <Building2 key="b" size={14} />,
                '워크스페이스 멤버 모두',
                '링크를 아는 멤버(게스트 제외)는 누구나 열 수 있어요.',
              ],
            ] as const
          )
            .filter(([value]) =>
              isWiki ? value === 'workspace' : !isGuest || value === 'private' || doc.visibility === value,
            )
            .map(([value, icon, label, hint]) => (
              <label key={value} className={doc.visibility === value ? 'selected' : undefined}>
                <input
                  type="radio"
                  name="doc-visibility"
                  checked={doc.visibility === value}
                  disabled={!manage || isWiki}
                  onChange={() => run(axios.patch(`${base}/settings`, { visibility: value }))}
                />
                <span>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {icon} {label}
                    {value === 'workspace' && doc.visibility === 'workspace' && (
                      <select
                        value={doc.linkRole || 'view'}
                        aria-label="워크스페이스 멤버 권한"
                        disabled={!manage}
                        onChange={(e) => run(axios.patch(`${base}/settings`, { linkRole: e.target.value }))}
                        style={{ marginLeft: 'auto' }}
                      >
                        <option value="view">{ROLE_LABEL.view}</option>
                        <option value="edit">{ROLE_LABEL.edit}</option>
                      </select>
                    )}
                  </strong>
                  <small>
                    {isWiki
                      ? '위키 페이지는 워크스페이스 멤버 모두가 볼 수 있어요. 고칠 수 있는지는 오른쪽에서 정해요.'
                      : hint}
                  </small>
                </span>
              </label>
            ))}
        </ChoiceList>
        {!manage && <p className="hint">공개 범위와 공유는 문서를 만든 사람이나 관리자만 바꿀 수 있어요.</p>}
      </Field>

      <Field>
        <label htmlFor="doc-share-search">사람 추가</label>
        {manage && (
          <TextInput
            id="doc-share-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름 또는 이메일"
            autoComplete="off"
          />
        )}
        <ShareList>
          {candidates.slice(0, 6).map((m) => (
            <li key={m.id}>
              <img src={avatarUrl(m, 28)} alt="" />
              <span className="who">
                {m.nickname}
                <small>{m.email}</small>
              </span>
              <button type="button" onClick={() => run(axios.put(`${base}/shares`, { userId: m.id, role: 'view' }))}>
                보기 권한
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => run(axios.put(`${base}/shares`, { userId: m.id, role: 'edit' }))}
              >
                편집 권한
              </button>
            </li>
          ))}
          {doc.Owner && (
            <li>
              <img src={avatarUrl(doc.Owner, 28)} alt="" />
              <span className="who">
                {doc.Owner.nickname}
                {doc.Owner.id === me.id && ' (나)'}
                <small>{doc.Owner.email}</small>
              </span>
              <span className="role">소유자</span>
            </li>
          )}
          {doc.Shares.map((s) => (
            <li key={s.UserId}>
              <img src={avatarUrl(s.User, 28)} alt="" />
              <span className="who">
                {s.User.nickname}
                {s.UserId === me.id && ' (나)'}
                <small>{s.User.email}</small>
              </span>
              {manage ? (
                <>
                  <select
                    value={s.role}
                    aria-label={`${s.User.nickname} 권한`}
                    onChange={(e) => run(axios.put(`${base}/shares`, { userId: s.UserId, role: e.target.value }))}
                  >
                    <option value="view">{ROLE_LABEL.view}</option>
                    <option value="edit">{ROLE_LABEL.edit}</option>
                  </select>
                  <button type="button" onClick={() => run(axios.delete(`${base}/shares/${s.UserId}`))}>
                    빼기
                  </button>
                </>
              ) : (
                <span className="role">{ROLE_LABEL[s.role]}</span>
              )}
            </li>
          ))}
        </ShareList>
      </Field>

      {!!doc.channelTabs?.some((t) => t.access !== 'none') && (
        <Field>
          <label>채널 탭으로 준 권한</label>
          <ShareList aria-label="채널 탭 권한">
            {doc.channelTabs
              .filter((t) => t.access !== 'none')
              .map((t) => (
                <li key={t.channel}>
                  <span className="who">
                    #{t.channel} 멤버
                    <small>채널에 들어오면 받고, 나가면 빠져요. 바꾸려면 채널의 탭 메뉴에서.</small>
                  </span>
                  <span className="role">{ROLE_LABEL[t.access as 'view' | 'edit']}</span>
                </li>
              ))}
          </ShareList>
        </Field>
      )}

      <Field>
        <label htmlFor="doc-send-channel">채널에 보내기</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <select
            id="doc-send-channel"
            className="select"
            value={sendTo}
            onChange={(e) => setSendTo(e.target.value)}
            style={{ flex: '0 0 40%' }}
          >
            <option value="">채널 고르기</option>
            {writable.map((c) => (
              <option key={c.id} value={c.name}>
                {c.private ? '🔒 ' : '# '}
                {c.name}
              </option>
            ))}
          </select>
          <TextInput
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="함께 보낼 말 (선택)"
            aria-label="함께 보낼 말"
            maxLength={500}
          />
          <button type="button" className="send-btn" onClick={sendToChannel} disabled={!sendTo || sending}>
            <Send size={14} /> 보내기
          </button>
        </div>
        {canGrant && sendTo && (
          <label className="check-line">
            <input type="checkbox" checked={grant} onChange={(e) => setGrant(e.target.checked)} />#{sendTo} 사람들에게
            보기 권한도 주기 (지금은 비공개 문서예요)
          </label>
        )}
      </Field>

      <Field>
        <label htmlFor="doc-share-link">링크</label>
        <TextInput id="doc-share-link" readOnly value={link} onFocus={(e) => e.target.select()} />
        <p className="hint">
          {doc.visibility === 'private'
            ? '링크를 받아도 초대받지 않은 사람은 열 수 없어요. 대신 권한을 요청할 수 있어요.'
            : '워크스페이스 멤버는 링크로 열 수 있어요. 게스트는 초대해야 열 수 있어요.'}
        </p>
      </Field>
    </Modal>
  );
};

export default ShareDocModal;
