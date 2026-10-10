import Modal from '@components/Modal';
import { Actions, Field, FormError, InputGroup, TextInput } from '@components/ModalForm/styles';
import { Section } from '@components/ProfileModal/styles';
import { IUser, IWorkspace } from '@typings/db';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import React, { FC, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import useSWR from 'swr';

interface Props {
  show: boolean;
  workspace: IWorkspace;
  myId: number;
  onCloseModal: () => void;
  onUrlChanged: (oldUrl: string, newUrl: string) => void;
}

const URL_PATTERN = /^[a-zA-Z0-9-_]+$/;

// 워크스페이스 설정 (소유자만): 이름, 주소, 소유권 넘기기
const WorkspaceSettingsModal: FC<Props> = ({ show, workspace, myId, onCloseModal, onUrlChanged }) => {
  const [name, setName] = useState(workspace.name);
  const [url, setUrl] = useState(workspace.url);
  const [newOwner, setNewOwner] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: members } = useSWR<IUser[]>(show ? `/api/workspaces/${workspace.url}/members` : null, fetcher);

  useEffect(() => {
    if (show) {
      setName(workspace.name);
      setUrl(workspace.url);
      setNewOwner('');
      setError('');
    }
  }, [show, workspace.name, workspace.url]);

  const trimmedName = name.trim();
  const urlInvalid = !!url && !URL_PATTERN.test(url);
  const changed = trimmedName !== workspace.name || url !== workspace.url;

  const onSave = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!trimmedName || !url || urlInvalid || !changed) {
        return;
      }
      setBusy(true);
      setError('');
      const oldUrl = workspace.url;
      axios
        .patch(`/api/workspaces/${oldUrl}`, { name: trimmedName, url })
        .then(() => {
          toast.success('워크스페이스 설정을 저장했습니다.', { position: 'bottom-center' });
          onCloseModal();
          if (url !== oldUrl) {
            onUrlChanged(oldUrl, url);
          }
        })
        .catch((err) => setError(getErrorMessage(err)))
        .finally(() => setBusy(false));
    },
    [trimmedName, url, urlInvalid, changed, workspace.url, onCloseModal, onUrlChanged],
  );

  const target = members?.find((m) => String(m.id) === newOwner);
  const onTransfer = useCallback(() => {
    if (!target) {
      return;
    }
    setBusy(true);
    setError('');
    axios
      .put(`/api/workspaces/${workspace.url}/owner`, { userId: target.id })
      .then(() => {
        toast.success(`${target.nickname}님에게 소유권을 넘겼습니다.`, { position: 'bottom-center' });
        onCloseModal();
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setBusy(false));
  }, [target, workspace.url, onCloseModal]);

  return (
    <Modal show={show} onCloseModal={onCloseModal} title="워크스페이스 설정">
      {error && <FormError role="alert">{error}</FormError>}
      <Section>
        <form onSubmit={onSave}>
          <Field>
            <label htmlFor="workspace-name">이름</label>
            <TextInput id="workspace-name" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field>
            <label htmlFor="workspace-url">주소</label>
            <InputGroup className={urlInvalid ? 'invalid' : undefined}>
              <span>/workspace/</span>
              <input
                id="workspace-url"
                value={url}
                maxLength={30}
                onChange={(e) => setUrl(e.target.value.trim())}
                aria-invalid={urlInvalid}
              />
            </InputGroup>
            {urlInvalid ? (
              <p className="error">영문, 숫자, -, _ 만 쓸 수 있습니다.</p>
            ) : (
              <p className="hint">주소를 바꾸면 접속 중인 멤버들도 새 주소로 옮겨집니다.</p>
            )}
          </Field>
          <Actions style={{ marginTop: 0 }}>
            <button type="submit" className="primary" disabled={busy || !trimmedName || !url || urlInvalid || !changed}>
              저장
            </button>
          </Actions>
        </form>
      </Section>
      <Section>
        <h3>소유권 넘기기</h3>
        <Field>
          <label htmlFor="workspace-owner">새 소유자</label>
          <select
            id="workspace-owner"
            value={newOwner}
            onChange={(e) => setNewOwner(e.target.value)}
            style={{
              width: '100%',
              height: 40,
              borderRadius: 6,
              border: '1px solid var(--border-strong)',
              padding: '0 8px',
              background: 'var(--bg)',
              color: 'var(--text)',
            }}
          >
            <option value="">멤버 선택</option>
            {members
              ?.filter((m) => m.id !== myId)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nickname} ({m.email})
                </option>
              ))}
          </select>
          <p className="hint">넘기고 나면 워크스페이스 설정과 멤버 내보내기는 새 소유자만 할 수 있습니다.</p>
        </Field>
        <Actions style={{ marginTop: 0 }}>
          <button type="button" className="primary" disabled={busy || !target} onClick={onTransfer}>
            소유권 넘기기
          </button>
        </Actions>
      </Section>
    </Modal>
  );
};

export default WorkspaceSettingsModal;
