import Modal from '@components/Modal';
import { Actions, Field, FormError, InputGroup, TextInput } from '@components/ModalForm/styles';
import { IUser, IWorkspace } from '@typings/db';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import React, { FC, useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import useSWR from 'swr';

const URL_PATTERN = /^[a-zA-Z0-9-_]+$/;
const MAX_LENGTH = 30;

// 영문 이름이면 url 을 추천한다 (예: "My Team" → "my-team"). 한글만 있으면 추천하지 않는다.
const suggestUrl = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_LENGTH);

const validateUrl = (url: string) => {
  if (!url) {
    return '';
  }
  if (!URL_PATTERN.test(url)) {
    return '영문, 숫자, 하이픈(-), 밑줄(_)만 사용할 수 있습니다.';
  }
  return '';
};

interface Props {
  show: boolean;
  onCloseModal: () => void;
}

const CreateWorkspaceModal: FC<Props> = ({ show, onCloseModal }) => {
  const history = useHistory();
  const { mutate: revalidateUser } = useSWR<IUser | false>('/api/users', fetcher);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [urlEdited, setUrlEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // 열 때마다 초기화
  useEffect(() => {
    if (show) {
      setName('');
      setUrl('');
      setUrlEdited(false);
      setServerError('');
    }
  }, [show]);

  const onChangeName = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.slice(0, MAX_LENGTH);
      setName(value);
      setServerError('');
      if (!urlEdited) {
        setUrl(suggestUrl(value));
      }
    },
    [urlEdited],
  );

  const onChangeUrl = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value.slice(0, MAX_LENGTH).trim());
    setUrlEdited(true);
    setServerError('');
  }, []);

  const urlError = validateUrl(url);
  const canSubmit = !!name.trim() && !!url && !urlError && !submitting;

  const onSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (!canSubmit) {
        return;
      }
      setSubmitting(true);
      axios
        .post<IWorkspace>('/api/workspaces', { workspace: name.trim(), url })
        .then(({ data }) =>
          revalidateUser().then(() => {
            onCloseModal();
            history.push(`/workspace/${data.url}/channel/일반`);
          }),
        )
        .catch((error) => setServerError(getErrorMessage(error)))
        .finally(() => setSubmitting(false));
    },
    [canSubmit, name, url, revalidateUser, onCloseModal, history],
  );

  return (
    <Modal
      show={show}
      onCloseModal={onCloseModal}
      title="워크스페이스 만들기"
      description="팀이 함께 대화할 새 공간을 만듭니다. 만들면 #일반 채널이 함께 생성됩니다."
    >
      <form onSubmit={onSubmit} noValidate>
        {serverError && <FormError role="alert">{serverError}</FormError>}
        <Field>
          <label htmlFor="workspace">워크스페이스 이름</label>
          <TextInput
            id="workspace"
            value={name}
            onChange={onChangeName}
            placeholder="예: 우리 회사, My Team"
            maxLength={MAX_LENGTH}
            autoComplete="off"
          />
          <p className="hint">
            {name.length}/{MAX_LENGTH}
          </p>
        </Field>
        <Field>
          <label htmlFor="workspace-url">워크스페이스 주소</label>
          <InputGroup className={urlError ? 'invalid' : undefined}>
            <span>/workspace/</span>
            <input
              id="workspace-url"
              value={url}
              onChange={onChangeUrl}
              placeholder="my-team"
              maxLength={MAX_LENGTH}
              autoComplete="off"
              aria-invalid={!!urlError}
              aria-describedby="workspace-url-hint"
            />
          </InputGroup>
          {urlError ? (
            <p className="error" id="workspace-url-hint">
              {urlError}
            </p>
          ) : (
            <p className="hint" id="workspace-url-hint">
              영문, 숫자, -, _ 를 사용할 수 있고 나중에 바꿀 수 없습니다.
            </p>
          )}
        </Field>
        <Actions>
          <button type="button" onClick={onCloseModal}>
            취소
          </button>
          <button type="submit" className="primary" disabled={!canSubmit}>
            {submitting ? '만드는 중...' : '만들기'}
          </button>
        </Actions>
      </form>
    </Modal>
  );
};

export default CreateWorkspaceModal;
