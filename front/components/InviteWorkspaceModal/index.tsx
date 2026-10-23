import Modal from '@components/Modal';
import { Actions, Field, FormError, TextInput } from '@components/ModalForm/styles';
import useMyRole, { isAdminRole } from '@hooks/useMyRole';
import { IChannel, IUser } from '@typings/db';
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
  // 관리자는 게스트(초대한 채널만 보는 외부 사람)로도 초대할 수 있다
  const canInviteGuest = isAdminRole(useMyRole(workspace));
  const [role, setRole] = useState<'member' | 'guest'>('member');
  const [channelIds, setChannelIds] = useState<number[]>([]);
  const { data: channels } = useSWR<IChannel[]>(
    show && canInviteGuest ? `/api/workspaces/${workspace}/channels` : null,
    fetcher,
  );

  useEffect(() => {
    if (show) {
      setEmail('');
      setTouched(false);
      setServerError('');
      setRole('member');
      setChannelIds([]);
    }
  }, [show]);

  const emailError = touched && email && !EMAIL_PATTERN.test(email.trim()) ? '올바른 이메일 주소를 입력해주세요.' : '';
  const canSubmit = EMAIL_PATTERN.test(email.trim()) && !submitting && (role === 'member' || channelIds.length > 0);

  const onInviteMember = useCallback(
    (e) => {
      e.preventDefault();
      setTouched(true);
      if (!canSubmit) {
        return;
      }
      setSubmitting(true);
      axios
        .post(
          `/api/workspaces/${workspace}/members`,
          role === 'guest' ? { email: email.trim(), role, channelIds } : { email: email.trim() },
        )
        .then(() => {
          revalidateMember();
          toast.success(`${email.trim()} 님을 ${role === 'guest' ? '게스트로 ' : ''}초대했습니다.`, {
            position: 'bottom-center',
          });
          setShowInviteWorkspaceModal(false);
        })
        .catch((error) => setServerError(getErrorMessage(error)))
        .finally(() => setSubmitting(false));
    },
    [canSubmit, email, workspace, role, channelIds, revalidateMember, setShowInviteWorkspaceModal],
  );

  return (
    <Modal
      show={show}
      onCloseModal={onCloseModal}
      title={workspaceName ? `${workspaceName}에 사람 초대` : '워크스페이스에 사람 초대'}
      description={
        role === 'guest'
          ? '게스트는 아래에서 고른 채널만 보고, 채널을 만들거나 다른 사람을 초대할 수 없어요.'
          : '이미 가입한 사람의 이메일을 입력하세요. 초대하면 #일반 채널에도 자동으로 참여합니다.'
      }
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
        {canInviteGuest && (
          <Field>
            <label htmlFor="invite-role">역할</label>
            <select
              id="invite-role"
              className="select"
              value={role}
              onChange={(e) => setRole(e.target.value as 'member' | 'guest')}
            >
              <option value="member">멤버 — 모든 공개 채널과 문서를 볼 수 있어요</option>
              <option value="guest">게스트 — 고른 채널만 (외부 협력사 등)</option>
            </select>
          </Field>
        )}
        {role === 'guest' && (
          <Field>
            <label>게스트가 들어갈 채널</label>
            <div className="channel-picks" role="group" aria-label="게스트가 들어갈 채널">
              {(channels || [])
                .filter((c) => !c.archived)
                .map((c) => (
                  <label key={c.id} className="pick">
                    <input
                      type="checkbox"
                      checked={channelIds.includes(c.id)}
                      onChange={(e) =>
                        setChannelIds((ids) => (e.target.checked ? [...ids, c.id] : ids.filter((id) => id !== c.id)))
                      }
                    />
                    {c.private ? '🔒' : '#'} {c.name}
                  </label>
                ))}
            </div>
            {!channelIds.length && <p className="hint">채널을 하나 이상 골라 주세요.</p>}
          </Field>
        )}
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
