import Modal from '@components/Modal';
import { Actions, Field, FormError, TextInput } from '@components/ModalForm/styles';
import useGroups from '@hooks/useGroups';
import { IUser, IUserGroup } from '@typings/db';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import React, { FC, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import useSWR from 'swr';
import { GroupList, MemberChecks } from './styles';

interface Props {
  show: boolean;
  workspace: string;
  me: IUser;
  isOwner: boolean; // 워크스페이스 소유자는 모든 그룹을 고칠 수 있다
  onCloseModal: () => void;
}

const NAME = /^[^\s@()[\]]+$/;

// 사용자 그룹: @그룹이름 으로 멘션하면 그룹 멤버에게 알린다
const GroupsModal: FC<Props> = ({ show, workspace, me, isOwner, onCloseModal }) => {
  const { data: groups } = useGroups(show ? workspace : undefined);
  const { data: members } = useSWR<IUser[]>(show ? `/api/workspaces/${workspace}/members` : null, fetcher);
  // 편집 중인 그룹 (null 이면 새로 만들기)
  const [editing, setEditing] = useState<IUserGroup | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [error, setError] = useState('');

  const reset = (group: IUserGroup | null) => {
    setEditing(group);
    setName(group?.name || '');
    setDescription(group?.description || '');
    setMemberIds(group ? group.Members.map((m) => m.UserId) : [me.id]);
    setError('');
  };

  useEffect(() => {
    if (show) {
      reset(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const base = `/api/workspaces/${workspace}/groups`;
  const fail = (err: unknown) => setError(getErrorMessage(err));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!NAME.test(trimmed)) {
      setError('그룹 이름을 입력해 주세요. 공백, @, 괄호는 쓸 수 없습니다.');
      return;
    }
    const body = { name: trimmed, description: description.trim(), memberIds };
    (editing ? axios.patch(`${base}/${editing.id}`, body) : axios.post(base, body))
      .then(() => {
        toast.success(editing ? '그룹을 고쳤습니다.' : `@${trimmed} 그룹을 만들었습니다.`, {
          position: 'bottom-center',
        });
        reset(null);
      })
      .catch(fail);
  };

  const onDelete = (group: IUserGroup) =>
    axios
      .delete(`${base}/${group.id}`)
      .then(() => {
        toast.info(`@${group.name} 그룹을 지웠습니다.`, { position: 'bottom-center' });
        if (editing?.id === group.id) {
          reset(null);
        }
      })
      .catch(fail);

  const onToggleMine = (group: IUserGroup, joined: boolean) =>
    (joined ? axios.delete(`${base}/${group.id}/members/me`) : axios.post(`${base}/${group.id}/members/me`)).catch(
      fail,
    );

  const canManage = (group: IUserGroup) => isOwner || group.CreatorId === me.id;

  return (
    <Modal
      show={show}
      onCloseModal={onCloseModal}
      title="사용자 그룹"
      description="메시지에서 @그룹이름 으로 멘션하면 그룹 멤버(채널에 있는 사람)에게 알립니다."
    >
      <GroupList>
        {!groups && <li className="empty">불러오는 중...</li>}
        {groups?.length === 0 && <li className="empty">아직 그룹이 없습니다. 아래에서 만들어 보세요.</li>}
        {groups?.map((group) => {
          const joined = group.Members.some((m) => m.UserId === me.id);
          return (
            <li key={group.id}>
              <div className="row">
                <span className="name">@{group.name}</span>
                <button type="button" onClick={() => onToggleMine(group, joined)}>
                  {joined ? '나가기' : '참여'}
                </button>
                {canManage(group) && (
                  <>
                    <button type="button" onClick={() => reset(group)}>
                      고치기
                    </button>
                    <button type="button" className="danger" onClick={() => onDelete(group)}>
                      삭제
                    </button>
                  </>
                )}
              </div>
              {group.description && <div className="desc">{group.description}</div>}
              <div className="members">
                {group.Members.length ? group.Members.map((m) => m.User.nickname).join(', ') : '멤버 없음'}
              </div>
            </li>
          );
        })}
      </GroupList>
      <form onSubmit={onSubmit}>
        <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{editing ? `@${editing.name} 고치기` : '새 그룹'}</h3>
        <Field>
          <label htmlFor="group-name">이름</label>
          <TextInput
            id="group-name"
            value={name}
            maxLength={30}
            placeholder="디자인팀"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field>
          <label htmlFor="group-desc">설명 (선택)</label>
          <TextInput
            id="group-desc"
            value={description}
            maxLength={100}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field>
          <label>멤버</label>
          <MemberChecks>
            {members?.map((member) => (
              <label key={member.id}>
                <input
                  type="checkbox"
                  checked={memberIds.includes(member.id)}
                  onChange={(e) =>
                    setMemberIds((prev) =>
                      e.target.checked ? [...prev, member.id] : prev.filter((id) => id !== member.id),
                    )
                  }
                />
                {member.nickname}
              </label>
            ))}
          </MemberChecks>
        </Field>
        {error && <FormError role="alert">{error}</FormError>}
        <Actions>
          {editing && (
            <button type="button" onClick={() => reset(null)}>
              취소
            </button>
          )}
          <button type="submit" className="primary">
            {editing ? '저장' : '그룹 만들기'}
          </button>
        </Actions>
      </form>
    </Modal>
  );
};

export default GroupsModal;
