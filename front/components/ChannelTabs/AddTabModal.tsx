import Modal from '@components/Modal';
import { FormError, TextInput } from '@components/ModalForm/styles';
import useMyRole, { isAdminRole } from '@hooks/useMyRole';
import DocIcon from '@pages/Docs/DocIcon';
import { IDocListItem, IUser } from '@typings/db';
import { DOC_TYPE_INFO, DocType } from '@utils/docTemplates';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import React, { FC, useEffect, useState } from 'react';
import useSWR from 'swr';
import { AddTab } from './styles';

// 채널에서 바로 만들 수 있는 종류 (위키는 위키 메뉴에서)
const NEW_TYPES: DocType[] = ['doc', 'database', 'board', 'design', 'sheet', 'slides'];

interface Props {
  workspace: string;
  channel: string;
  onClose: () => void;
  onAdded: (docId: number) => void;
}

// 탭 추가: 새 문서를 만들거나(채널 멤버 모두 함께 고침), 있는 문서를 고른다
const AddTabModal: FC<Props> = ({ workspace, channel, onClose, onAdded }) => {
  const { data: me } = useSWR<IUser>('/api/users', fetcher);
  const isAdmin = isAdminRole(useMyRole(workspace));
  const [mode, setMode] = useState<'new' | 'pick'>('new');
  const [type, setType] = useState<DocType>('doc');
  const [title, setTitle] = useState('');
  const [newAccess, setNewAccess] = useState<'edit' | 'view'>('edit');
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<IDocListItem | null>(null);
  const [access, setAccess] = useState<'none' | 'view' | 'edit'>('none');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(query.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [query]);
  const { data: docs } = useSWR<IDocListItem[]>(
    mode === 'pick' ? `/api/workspaces/${workspace}/docs?tab=all${q ? `&q=${encodeURIComponent(q)}` : ''}` : null,
    fetcher,
  );
  // 문서를 만든 사람(이나 관리자)만 채널 멤버에게 권한을 줄 수 있다
  const canGrant = !!picked && (picked.ownerId === me?.id || isAdmin);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || (mode === 'pick' && !picked)) return;
    setPending(true);
    setError('');
    const body =
      mode === 'new'
        ? { newType: type, newTitle: title.trim() || undefined, access: newAccess }
        : { docId: picked!.id, access: canGrant ? access : 'none' };
    axios
      .post<{ docId: number }>(`/api/workspaces/${workspace}/channels/${encodeURIComponent(channel)}/tabs`, body)
      .then(({ data }) => onAdded(data.docId))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setPending(false));
  };

  return (
    <Modal
      show
      onCloseModal={onClose}
      title={`#${channel} 에 탭 추가`}
      description="채팅 옆에 문서를 고정해 두고 함께 써요."
    >
      <AddTab onSubmit={submit}>
        <div className="modes" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'new'}
            className={mode === 'new' ? 'on' : ''}
            onClick={() => setMode('new')}
          >
            새로 만들기
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'pick'}
            className={mode === 'pick' ? 'on' : ''}
            onClick={() => setMode('pick')}
          >
            있는 문서 고르기
          </button>
        </div>
        {error && <FormError role="alert">{error}</FormError>}
        {mode === 'new' ? (
          <>
            <div className="types" role="radiogroup" aria-label="만들 종류">
              {NEW_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={type === t}
                  className={type === t ? 'on' : undefined}
                  onClick={() => setType(t)}
                >
                  <DocIcon type={t} size={18} />
                  {DOC_TYPE_INFO[t].label}
                </button>
              ))}
            </div>
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder={`제목 (예: ${channel} 회의록)`}
              aria-label="탭 문서 제목"
            />
            <label className="access">
              #{channel} 멤버
              <select
                value={newAccess}
                onChange={(e) => setNewAccess(e.target.value as 'edit' | 'view')}
                aria-label="채널 멤버 권한"
              >
                <option value="edit">모두 고칠 수 있음</option>
                <option value="view">보기만</option>
              </select>
            </label>
            <p className="hint">채널에 들어오는 사람은 자동으로 권한을 받고, 나가면 권한이 빠져요.</p>
          </>
        ) : (
          <>
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="문서 제목 찾기"
              aria-label="문서 찾기"
            />
            <ul className="docs" role="listbox" aria-label="문서">
              {(docs || []).slice(0, 30).map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={picked?.id === d.id}
                    className={picked?.id === d.id ? 'on' : undefined}
                    onClick={() => {
                      setPicked(d);
                      setAccess('none');
                    }}
                  >
                    <DocIcon type={d.type} size={15} />
                    <span>{d.title}</span>
                    <small>{d.ownerName}</small>
                  </button>
                </li>
              ))}
              {docs && !docs.length && <li className="hint">찾는 문서가 없어요.</li>}
            </ul>
            {picked && (
              <label className="access">
                #{channel} 멤버
                <select
                  value={canGrant ? access : 'none'}
                  disabled={!canGrant}
                  onChange={(e) => setAccess(e.target.value as 'none' | 'view' | 'edit')}
                  aria-label="채널 멤버 권한"
                >
                  <option value="none">문서 권한 그대로 (링크만)</option>
                  <option value="view">보기 권한 주기</option>
                  <option value="edit">편집 권한 주기</option>
                </select>
              </label>
            )}
            {picked && !canGrant && (
              <p className="hint">
                문서를 만든 사람이나 관리자만 채널 멤버에게 권한을 줄 수 있어요. 볼 권한이 없는 멤버는 탭에서 권한을
                요청할 수 있어요.
              </p>
            )}
          </>
        )}
        <div className="actions">
          <button type="button" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="primary" disabled={pending || (mode === 'pick' && !picked)}>
            {pending ? '추가하는 중…' : '탭 추가'}
          </button>
        </div>
      </AddTab>
    </Modal>
  );
};

export default AddTabModal;
