import Modal from '@components/Modal';
import { Field, FormError, TextInput } from '@components/ModalForm/styles';
import { IChannel, IUser } from '@typings/db';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import { avatarUrl } from '@utils/avatar';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { toast } from 'react-toastify';
import useSWR from 'swr';
import { MemberList, MemberRow } from './styles';

interface Props {
  show: boolean;
  onCloseModal: () => void;
  setShowInviteChannelModal: (flag: boolean) => void;
}

// 워크스페이스 멤버 중 채널에 없는 사람을 검색해서 초대한다
const InviteChannelModal: FC<Props> = ({ show, onCloseModal }) => {
  const { workspace, channel } = useParams<{ workspace: string; channel: string }>();
  const [query, setQuery] = useState('');
  const [inviting, setInviting] = useState<number | null>(null);
  const [serverError, setServerError] = useState('');
  const { data: workspaceMembers } = useSWR<IUser[]>(show ? `/api/workspaces/${workspace}/members` : null, fetcher);
  const { data: channelMembers, mutate: revalidateMembers } = useSWR<IUser[]>(
    show ? `/api/workspaces/${workspace}/channels/${channel}/members` : null,
    fetcher,
  );
  const { data: channels } = useSWR<IChannel[]>(`/api/workspaces/${workspace}/channels`, fetcher);
  const isPrivate = channels?.find((c) => c.name === channel)?.private;

  useEffect(() => {
    if (show) {
      setQuery('');
      setServerError('');
    }
  }, [show]);

  const candidates = useMemo(() => {
    const memberIds = new Set((channelMembers || []).map((m) => m.id));
    const q = query.trim().toLowerCase();
    return (workspaceMembers || [])
      .filter((m) => !memberIds.has(m.id))
      .filter((m) => !q || m.nickname.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  }, [workspaceMembers, channelMembers, query]);

  const onInvite = useCallback(
    (member: IUser) => {
      setInviting(member.id);
      setServerError('');
      axios
        .post(`/api/workspaces/${workspace}/channels/${channel}/members`, { email: member.email })
        .then(() => revalidateMembers())
        .then(() => toast.success(`${member.nickname} 님을 #${channel}에 초대했습니다.`, { position: 'bottom-center' }))
        .catch((error) => setServerError(getErrorMessage(error)))
        .finally(() => setInviting(null));
    },
    [workspace, channel, revalidateMembers],
  );

  const loading = !workspaceMembers || !channelMembers;

  return (
    <Modal
      show={show}
      onCloseModal={onCloseModal}
      title={`${isPrivate ? '🔒 ' : '#'}${channel}에 사람 초대`}
      description="워크스페이스 멤버 중에서 이름이나 이메일로 찾아 초대하세요."
    >
      {serverError && <FormError role="alert">{serverError}</FormError>}
      <Field>
        <TextInput
          id="member"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름 또는 이메일로 검색"
          autoComplete="off"
          aria-label="초대할 멤버 검색"
        />
      </Field>
      <MemberList>
        {loading && <p>불러오는 중...</p>}
        {!loading && candidates.length === 0 && (
          <p>{query ? '검색 결과가 없습니다.' : '워크스페이스의 모든 멤버가 이미 채널에 있습니다.'}</p>
        )}
        {candidates.map((member) => (
          <MemberRow key={member.id}>
            <img src={avatarUrl(member, 32)} alt="" />
            <div>
              <b>{member.nickname}</b>
              <small>{member.email}</small>
            </div>
            <button type="button" disabled={inviting === member.id} onClick={() => onInvite(member)}>
              {inviting === member.id ? '초대 중...' : '초대'}
            </button>
          </MemberRow>
        ))}
      </MemberList>
    </Modal>
  );
};

export default InviteChannelModal;
