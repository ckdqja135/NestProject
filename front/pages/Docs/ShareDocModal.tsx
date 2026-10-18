import Modal from '@components/Modal';
import { ChoiceList, Field, FormError, TextInput } from '@components/ModalForm/styles';
import { IDoc, IUser } from '@typings/db';
import { avatarUrl } from '@utils/avatar';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import React, { FC, useEffect, useState } from 'react';
import { Building2, Lock } from 'lucide-react';
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

// 문서 공유: 공개 범위 (나만·워크스페이스) + 사람별 보기/편집 권한
const ShareDocModal: FC<Props> = ({ show, workspace, doc, me, onCloseModal, onChanged }) => {
  const { data: members } = useSWR<IUser[]>(show ? `/api/workspaces/${workspace}/members` : null, fetcher);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const base = `${docsBase(workspace)}/docs/${doc.id}`;
  const manage = doc.canManage;
  useEffect(() => {
    if (show) {
      setQuery('');
      setError('');
    }
  }, [show]);

  const run = (request: Promise<unknown>) => request.then(onChanged).catch((err) => setError(getErrorMessage(err)));

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

  return (
    <Modal show={show} onCloseModal={onCloseModal} title={`'${doc.title}' 공유`}>
      {error && <FormError role="alert">{error}</FormError>}
      <Field>
        <label>공개 범위</label>
        {isWiki ? (
          <p className="hint">위키 페이지는 언제나 워크스페이스 모두가 보고 고칠 수 있습니다.</p>
        ) : (
          <ChoiceList>
            {(
              [
                ['private', <Lock key="l" size={14} />, '나와 공유한 사람만', '아래에 추가한 사람만 볼 수 있습니다.'],
                [
                  'workspace',
                  <Building2 key="b" size={14} />,
                  '워크스페이스 모두',
                  '워크스페이스 멤버 모두가 보고 고칠 수 있습니다.',
                ],
              ] as const
            ).map(([value, icon, label, hint]) => (
              <label key={value} className={doc.visibility === value ? 'selected' : undefined}>
                <input
                  type="radio"
                  name="doc-visibility"
                  checked={doc.visibility === value}
                  disabled={!manage}
                  onChange={() => run(axios.patch(`${base}/settings`, { visibility: value }))}
                />
                <span>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {icon} {label}
                  </strong>
                  <small>{hint}</small>
                </span>
              </label>
            ))}
          </ChoiceList>
        )}
        {!manage && <p className="hint">공개 범위와 공유는 문서를 만든 사람만 바꿀 수 있습니다.</p>}
      </Field>

      {!isWiki && (
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
      )}

      <Field>
        <label htmlFor="doc-share-link">링크</label>
        <TextInput id="doc-share-link" readOnly value={link} onFocus={(e) => e.target.select()} />
        <p className="hint">볼 권한이 있는 사람만 링크로 열 수 있습니다.</p>
      </Field>
    </Modal>
  );
};

export default ShareDocModal;
