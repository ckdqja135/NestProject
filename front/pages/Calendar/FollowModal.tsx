import Modal from '@components/Modal';
import { TextInput } from '@components/ModalForm/styles';
import { IUser } from '@typings/db';
import { avatarUrl } from '@utils/avatar';
import axios from 'axios';
import React, { FC, useState } from 'react';
import { calBase, toastError } from './api';
import { PeopleList } from './styles';

interface Props {
  show: boolean;
  workspace: string;
  me: IUser;
  members: IUser[];
  follows: IUser[];
  onClose: () => void;
  onChanged: () => void;
}

// 동료 캘린더 구독: 동료의 일정을 내 캘린더에 겹쳐 본다 (비공개 일정은 '바쁨' 으로만)
const FollowModal: FC<Props> = ({ show, workspace, me, members, follows, onClose, onChanged }) => {
  const [query, setQuery] = useState('');
  const keyword = query.trim().toLowerCase();
  const people = members.filter(
    (m) =>
      m.id !== me.id &&
      !m.bot &&
      (!keyword || m.nickname.toLowerCase().includes(keyword) || m.email.toLowerCase().includes(keyword)),
  );
  const following = new Set(follows.map((f) => f.id));
  const toggle = (user: IUser) =>
    (following.has(user.id)
      ? axios.delete(`${calBase(workspace)}/follows/${user.id}`)
      : axios.put(`${calBase(workspace)}/follows/${user.id}`)
    )
      .then(onChanged)
      .catch(toastError);

  return (
    <Modal
      show={show}
      onCloseModal={onClose}
      title="동료 캘린더 구독"
      description="구독한 동료의 일정이 내 캘린더에 함께 보입니다. 비공개 일정은 '바쁨' 으로만 보여요."
    >
      <TextInput
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="이름이나 이메일로 찾기"
        autoComplete="off"
      />
      <PeopleList style={{ marginTop: 8 }}>
        {people.length === 0 && <p>구독할 수 있는 동료가 없습니다.</p>}
        {people.map((m) => (
          <div className="row" key={m.id}>
            <img src={avatarUrl(m, 24)} alt="" />
            <span className="who">
              {m.nickname}
              <small>{m.email}</small>
            </span>
            <button type="button" className={following.has(m.id) ? 'on' : undefined} onClick={() => toggle(m)}>
              {following.has(m.id) ? '구독 중 · 끊기' : '구독'}
            </button>
          </div>
        ))}
      </PeopleList>
    </Modal>
  );
};

export default FollowModal;
