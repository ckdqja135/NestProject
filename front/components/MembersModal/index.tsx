import Modal from '@components/Modal';
import { Field, FormError, TextInput } from '@components/ModalForm/styles';
import useMyRole, { isAdminRole, ROLE_LABELS } from '@hooks/useMyRole';
import useOnlineList from '@hooks/useOnlineList';
import { IUser, IWorkspace, WorkspaceRole } from '@typings/db';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import { avatarUrl } from '@utils/avatar';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import useSWR from 'swr';
import { MemberList, MemberRow } from './styles';

interface Props {
  show: boolean;
  onCloseModal: () => void;
  workspace: IWorkspace;
  me: IUser;
  onInvite: () => void;
}

// 워크스페이스 멤버 목록. 관리자는 역할을 바꾸고 멤버를 내보낼 수 있고, 소유자가 아니면 스스로 나갈 수 있다.
// (관리자 지정·해제와 관리자 내보내기는 소유자만)
const MembersModal: FC<Props> = ({ show, onCloseModal, workspace, me, onInvite }) => {
  const membersKey = `/api/workspaces/${workspace.url}/members`;
  const { data: members, mutate } = useSWR<IUser[]>(show ? membersKey : null, fetcher);
  const { mutate: revalidateUser } = useSWR('/api/users', fetcher);
  const onlineList = useOnlineList(workspace.url);
  const [query, setQuery] = useState('');
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const myRole = useMyRole(workspace.url);
  const isOwner = workspace.OwnerId === me.id;
  const amAdmin = isAdminRole(myRole);

  useEffect(() => {
    if (show) {
      setQuery('');
      setConfirmId(null);
      setError('');
    }
  }, [show]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (members || [])
      .filter((m) => !q || m.nickname.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
      .sort((a, b) => {
        // 소유자 → 관리자 → 나 → 온라인 → 이름순 (게스트는 뒤로)
        const order: Record<WorkspaceRole, number> = { owner: 0, admin: 8, member: 16, guest: 24 };
        const rank = (m: IUser) =>
          order[m.id === workspace.OwnerId ? 'owner' : m.role || 'member'] +
          (m.id === me.id ? 0 : 2) +
          (onlineList.includes(m.id) ? 0 : 1);
        return rank(a) - rank(b) || a.nickname.localeCompare(b.nickname);
      });
  }, [members, query, workspace.OwnerId, me.id, onlineList]);

  const onRemove = useCallback(
    (member: IUser) => {
      const leaving = member.id === me.id;
      setPending(true);
      setError('');
      axios
        .delete(`/api/workspaces/${workspace.url}/members/${member.id}`)
        .then(() => {
          setConfirmId(null);
          if (leaving) {
            toast.info(`${workspace.name} 워크스페이스에서 나갔습니다.`, { position: 'bottom-center' });
            onCloseModal();
            // 워크스페이스 목록이 갱신되면 레이아웃이 남은 첫 워크스페이스로 이동시킨다
            return revalidateUser();
          }
          toast.success(`${member.nickname} 님을 내보냈습니다.`, { position: 'bottom-center' });
          return mutate();
        })
        .catch((err) => setError(getErrorMessage(err)))
        .finally(() => setPending(false));
    },
    [me.id, workspace, onCloseModal, revalidateUser, mutate],
  );

  const onRole = useCallback(
    (member: IUser, role: WorkspaceRole) => {
      setError('');
      axios
        .put(`/api/workspaces/${workspace.url}/members/${member.id}/role`, { role })
        .then(() => {
          toast.success(`${member.nickname} 님을 ${ROLE_LABELS[role]}(으)로 바꿨습니다.`, {
            position: 'bottom-center',
          });
          return mutate();
        })
        .catch((err) => setError(getErrorMessage(err)));
    },
    [workspace.url, mutate],
  );

  return (
    <Modal
      show={show}
      onCloseModal={onCloseModal}
      title={`${workspace.name} 멤버`}
      description={members ? `멤버 ${members.length}명` : undefined}
    >
      {error && <FormError role="alert">{error}</FormError>}
      <Field>
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름 또는 이메일로 검색"
          aria-label="멤버 검색"
          autoComplete="off"
        />
      </Field>
      <MemberList>
        {!members && <p>불러오는 중...</p>}
        {members && filtered.length === 0 && <p>검색 결과가 없습니다.</p>}
        {filtered.map((member) => {
          const isMe = member.id === me.id;
          const isMemberOwner = member.id === workspace.OwnerId;
          const role: WorkspaceRole = isMemberOwner ? 'owner' : member.role || 'member';
          // 관리자는 멤버·게스트를, 소유자는 관리자도 내보낸다
          const canManageMember = !isMe && !isMemberOwner && !member.bot && amAdmin && (role !== 'admin' || isOwner);
          const canRemove = canManageMember || (isMe && !isOwner);
          return (
            <MemberRow key={member.id}>
              <span className="avatar">
                <img src={avatarUrl(member, 64)} alt="" />
                <i className={onlineList.includes(member.id) ? 'online' : undefined} />
              </span>
              <div>
                <b>
                  {member.nickname}
                  {isMe && <span className="me"> (나)</span>}
                  {role !== 'member' && <span className={`badge ${role}`}>{ROLE_LABELS[role]}</span>}
                </b>
                <small>{member.email}</small>
              </div>
              {canManageMember && confirmId !== member.id && (
                <select
                  className="role-select"
                  value={role}
                  onChange={(e) => onRole(member, e.target.value as WorkspaceRole)}
                  aria-label={`${member.nickname} 역할`}
                >
                  {isOwner && <option value="admin">관리자</option>}
                  <option value="member">멤버</option>
                  <option value="guest">게스트</option>
                </select>
              )}
              {canRemove &&
                (confirmId === member.id ? (
                  <span className="confirm">
                    <button type="button" onClick={() => setConfirmId(null)} disabled={pending}>
                      취소
                    </button>
                    <button type="button" className="danger" onClick={() => onRemove(member)} disabled={pending}>
                      {isMe ? '나가기' : '내보내기'}
                    </button>
                  </span>
                ) : (
                  <button type="button" className="outline-danger" onClick={() => setConfirmId(member.id)}>
                    {isMe ? '워크스페이스 나가기' : '내보내기'}
                  </button>
                ))}
            </MemberRow>
          );
        })}
      </MemberList>
      <p className="footer-hint" style={{ margin: '16px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
        {isOwner ? '소유자는 워크스페이스를 나갈 수 없습니다. ' : ''}
        {myRole !== 'guest' && (
          <button
            type="button"
            onClick={onInvite}
            style={{
              border: 'none',
              background: 'none',
              color: '#1264a3',
              cursor: 'pointer',
              padding: 0,
              fontSize: 13,
            }}
          >
            사람 초대하기
          </button>
        )}
      </p>
    </Modal>
  );
};

export default MembersModal;
