import { ChannelRow, List } from '@components/BrowseChannelsModal/styles';
import Modal from '@components/Modal';
import { IChannel } from '@typings/db';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import React, { FC, useCallback, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { toast } from 'react-toastify';
import useSWR from 'swr';

interface BrowseChannel extends IChannel {
  memberCount: number;
  joined: boolean;
}

interface Props {
  show: boolean;
  workspace?: string;
  onCloseModal: () => void;
}

// 채널 둘러보기: 공개 채널만 보여주고 바로 참여할 수 있다. 비공개 채널은 초대로만 들어온다.
const BrowseChannelsModal: FC<Props> = ({ show, workspace, onCloseModal }) => {
  const history = useHistory();
  const [joining, setJoining] = useState<string | null>(null);
  const { data: channels, mutate } = useSWR<BrowseChannel[]>(
    show && workspace ? `/api/workspaces/${workspace}/channels/browse` : null,
    fetcher,
  );
  const { mutate: mutateMyChannels } = useSWR<IChannel[]>(
    workspace ? `/api/workspaces/${workspace}/channels` : null,
    fetcher,
  );

  const onOpen = useCallback(
    (channel: BrowseChannel) => {
      onCloseModal();
      history.push(`/workspace/${workspace}/channel/${channel.name}`);
    },
    [history, workspace, onCloseModal],
  );

  const onJoin = useCallback(
    (channel: BrowseChannel) => {
      setJoining(channel.name);
      axios
        .post(`/api/workspaces/${workspace}/channels/${channel.name}/join`)
        .then(() => Promise.all([mutateMyChannels(), mutate()]))
        .then(() => onOpen(channel))
        .catch((error) => toast.error(getErrorMessage(error), { position: 'bottom-center' }))
        .finally(() => setJoining(null));
    },
    [workspace, mutate, mutateMyChannels, onOpen],
  );

  return (
    <Modal
      show={show}
      onCloseModal={onCloseModal}
      title="채널 둘러보기"
      description="공개 채널은 누구나 참여할 수 있습니다. 🔒 비공개 채널은 초대받아야 볼 수 있습니다."
    >
      <List>
        {!channels && <p>불러오는 중...</p>}
        {channels?.length === 0 && <p>공개 채널이 없습니다.</p>}
        {channels?.map((channel) => (
          <ChannelRow key={channel.id}>
            <div>
              <b># {channel.name}</b>
              <small>멤버 {channel.memberCount}명</small>
            </div>
            {channel.joined ? (
              <button type="button" onClick={() => onOpen(channel)}>
                열기
              </button>
            ) : (
              <button
                type="button"
                className="primary"
                disabled={joining === channel.name}
                onClick={() => onJoin(channel)}
              >
                {joining === channel.name ? '참여 중...' : '참여'}
              </button>
            )}
          </ChannelRow>
        ))}
      </List>
    </Modal>
  );
};

export default BrowseChannelsModal;
