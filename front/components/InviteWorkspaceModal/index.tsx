import Modal from '@components/Modal';
import { Actions, Field, FormError, TextInput } from '@components/ModalForm/styles';
import { IUser } from '@typings/db';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import React, { FC, useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { toast } from 'react-toastify';
import useSWR from 'swr';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  show: boolean;
  onCloseModal: () => void;
  setShowInviteWorkspaceModal: (flag: boolean) => void;
}
const InviteWorkspaceModal: FC<Props> = ({ show, onCloseModal, setShowInviteWorkspaceModal }) => {
  const { workspace } = useParams<{ workspace: string; channel: string }>();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const { data: userData } = useSWR<IUser & { Workspaces: { url: string; name: string }[] }>('/api/users', fetcher);
  const { mutate: revalidateMember } = useSWR<IUser[]>(
    userData ? `/api/workspaces/${workspace}/members` : null,
    fetcher,
  );
  const workspaceName = userData?.Workspaces?.find((w) => w.url === workspace)?.name;

  useEffect(() => {
    if (show) {
      setEmail('');
      setTouched(false);
      setServerError('');
    }
  }, [show]);

  const emailError = touched && email && !EMAIL_PATTERN.test(email.trim()) ? '올바른 이메일 주소를 입력해주세요.' : '';
  const canSubmit = EMAIL_PATTERN.test(email.trim()) && !submitting;

  const onInviteMember = useCallback(
    (e) => {
      e.preventDefault();
      setTouched(true);
      if (!canSubmit) {
        return;
      }
      setSubmitting(true);
      axios
        .post(`/api/workspaces/${workspace}/members`, { email: email.trim() })
        .then(() => {
          revalidateMember();
          toast.success(`${email.trim()} 님을 초대했습니다.`, { position: 'bottom-center' });
          setShowInviteWorkspaceModal(false);
        })
        .catch((error) => setServerError(getErrorMessage(error)))
        .finally(() => setSubmitting(false));
    },
    [canSubmit, email, workspace, revalidateMember, setShowInviteWorkspaceModal],
  );

  return (
    <Modal
      show={show}
      onCloseModal={onCloseModal}
      title={workspaceName ? `${workspaceName}에 사람 초대` : '워크스페이스에 사람 초대'}
      description="이미 가입한 사람의 이메일을 입력하세요. 초대하면 #일반 채널에도 자동으로 참여합니다."
    >
      <form onSubmit={onInviteMember} noValidate>
        {serverError && <FormError role="alert">{serverError}</FormError>}
        <Field>
          <label htmlFor="member">이메일</label>
          <TextInput
            id="member"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setServerError('');
            }}
            onBlur={() => setTouched(true)}
            placeholder="name@example.com"
            autoComplete="off"
            aria-invalid={!!emailError}
          />
          {emailError && <p className="error">{emailError}</p>}
        </Field>
        <Actions>
          <button type="button" onClick={onCloseModal}>
            취소
          </button>
          <button type="submit" className="primary" disabled={!canSubmit}>
            {submitting ? '초대하는 중...' : '초대하기'}
          </button>
        </Actions>
      </form>
    </Modal>
  );
};

export default InviteWorkspaceModal;
