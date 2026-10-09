import Modal from '@components/Modal';
import { Actions, ChoiceList, Field, FormError, InputGroup } from '@components/ModalForm/styles';
import { IChannel } from '@typings/db';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import React, { FC, useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useHistory } from 'react-router-dom';
import useSWR from 'swr';

const MAX_LENGTH = 30;

// 채널 이름은 주소에 그대로 들어가므로 경로를 깨는 문자는 쓸 수 없다
const validateName = (name: string) => {
  if (/[/?#%\\]/.test(name)) {
    return '/, ?, #, %, \\ 는 채널 이름에 쓸 수 없습니다.';
  }
  if (name.trim() === 'browse') {
    return '사용할 수 없는 채널 이름입니다.';
  }
  return '';
};

interface Props {
  show: boolean;
  onCloseModal: () => void;
  setShowCreateChannelModal: (flag: boolean) => void;
}
const CreateChannelModal: FC<Props> = ({ show, onCloseModal, setShowCreateChannelModal }) => {
  const { workspace } = useParams<{ workspace?: string }>();
  const history = useHistory();
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const { mutate: revalidateChannel } = useSWR<IChannel[]>(
    workspace ? `/api/workspaces/${workspace}/channels` : null,
    fetcher,
  );

  useEffect(() => {
    if (show) {
      setName('');
      setIsPrivate(false);
      setServerError('');
    }
  }, [show]);

  const nameError = validateName(name);
  const canSubmit = !!name.trim() && !nameError && !submitting;

  const onCreateChannel = useCallback(
    (e) => {
      e.preventDefault();
      if (!canSubmit) {
        return;
      }
      setSubmitting(true);
      axios
        .post<IChannel>(`/api/workspaces/${workspace}/channels`, { name: name.trim(), private: isPrivate })
        .then(({ data }) =>
          // 채널 목록을 먼저 갱신해야 새 채널 화면이 '없는 채널'로 판단해 일반 채널로 돌아가지 않는다
          revalidateChannel().then(() => {
            setShowCreateChannelModal(false);
            history.push(`/workspace/${workspace}/channel/${data.name}`);
          }),
        )
        .catch((error) => setServerError(getErrorMessage(error)))
        .finally(() => setSubmitting(false));
    },
    [canSubmit, name, isPrivate, revalidateChannel, setShowCreateChannelModal, workspace, history],
  );

  return (
    <Modal
      show={show}
      onCloseModal={onCloseModal}
      title="채널 만들기"
      description="주제별로 대화를 나눌 채널을 만듭니다."
    >
      <form onSubmit={onCreateChannel} noValidate>
        {serverError && <FormError role="alert">{serverError}</FormError>}
        <Field>
          <label htmlFor="channel">이름</label>
          <InputGroup className={nameError ? 'invalid' : undefined}>
            <span>{isPrivate ? '🔒' : '#'}</span>
            <input
              id="channel"
              value={name}
              onChange={(e) => {
                setName(e.target.value.slice(0, MAX_LENGTH));
                setServerError('');
              }}
              placeholder="예: 공지사항, 프로젝트-a"
              maxLength={MAX_LENGTH}
              autoComplete="off"
              aria-invalid={!!nameError}
            />
          </InputGroup>
          {nameError ? (
            <p className="error">{nameError}</p>
          ) : (
            <p className="hint">
              {name.length}/{MAX_LENGTH}
            </p>
          )}
        </Field>
        <Field>
          <label>공개 범위</label>
          <ChoiceList role="radiogroup">
            <label className={!isPrivate ? 'selected' : undefined}>
              <input
                type="radio"
                name="channel-visibility"
                id="channel-public"
                checked={!isPrivate}
                onChange={() => setIsPrivate(false)}
              />
              <span>
                <strong># 공개</strong>
                <small>워크스페이스의 누구나 채널 둘러보기에서 찾아 참여할 수 있습니다.</small>
              </span>
            </label>
            <label className={isPrivate ? 'selected' : undefined}>
              <input
                type="radio"
                name="channel-visibility"
                id="channel-private"
                checked={isPrivate}
                onChange={() => setIsPrivate(true)}
              />
              <span>
                <strong>🔒 비공개</strong>
                <small>초대받은 사람만 채널을 보고 참여할 수 있습니다.</small>
              </span>
            </label>
          </ChoiceList>
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

export default CreateChannelModal;
