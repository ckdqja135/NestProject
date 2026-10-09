import Modal from '@components/Modal';
import useInput from '@hooks/useInput';
import { Button, Input, Label } from '@pages/SignUp/styles';
import { IChannel, IUser } from '@typings/db';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import React, { FC, useCallback, useState } from 'react';
import { useParams } from 'react-router';
import { useHistory } from 'react-router-dom';
import { toast } from 'react-toastify';
import useSWR from 'swr';

interface Props {
  show: boolean;
  onCloseModal: () => void;
  setShowCreateChannelModal: (flag: boolean) => void;
}
const CreateChannelModal: FC<Props> = ({ show, onCloseModal, setShowCreateChannelModal }) => {
  const params = useParams<{ workspace?: string }>();
  const { workspace } = params;
  const history = useHistory();
  const [newChannel, onChangeNewChannel, setNewChannel] = useInput('');
  const [isPrivate, setIsPrivate] = useState(false);
  const { data: userData } = useSWR<IUser | false>('/api/users', fetcher);
  const { mutate: revalidateChannel } = useSWR<IChannel[]>(
    userData ? `/api/workspaces/${workspace}/channels` : null,
    fetcher,
  );

  const onCreateChannel = useCallback(
    (e) => {
      e.preventDefault();
      if (!newChannel || !newChannel.trim()) {
        return;
      }
      axios
        .post<IChannel>(`/api/workspaces/${workspace}/channels`, {
          name: newChannel.trim(),
          private: isPrivate,
        })
        .then(({ data }) =>
          // 채널 목록을 먼저 갱신해야 새 채널 화면이 '없는 채널'로 판단해 일반 채널로 돌아가지 않는다
          revalidateChannel().then(() => {
            setShowCreateChannelModal(false);
            setNewChannel('');
            setIsPrivate(false);
            history.push(`/workspace/${workspace}/channel/${data.name}`);
          }),
        )
        .catch((error) => {
          console.dir(error);
          toast.error(getErrorMessage(error), { position: 'bottom-center' });
        });
    },
    [newChannel, isPrivate, revalidateChannel, setNewChannel, setShowCreateChannelModal, workspace, history],
  );

  return (
    <Modal show={show} onCloseModal={onCloseModal}>
      <form onSubmit={onCreateChannel}>
        <Label id="channel-label">
          <span>채널 이름</span>
          <Input id="channel" value={newChannel} onChange={onChangeNewChannel} />
        </Label>
        <Label id="channel-private-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            id="channel-private"
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            style={{ width: 16, height: 16, margin: 0 }}
          />
          <span style={{ margin: 0, fontWeight: 'normal', textAlign: 'left' }}>
            🔒 비공개 채널로 만들기
            <br />
            <small style={{ color: '#616061' }}>초대받은 사람만 채널을 보고 참여할 수 있습니다.</small>
          </span>
        </Label>
        <Button>생성하기</Button>
      </form>
    </Modal>
  );
};

export default CreateChannelModal;
