import { CollapseButton } from '@components/DMList/styles';
import BrowseChannelsModal from '@components/BrowseChannelsModal';
import EachChannel from '@components/EachChannel';
import useMentions from '@hooks/useMentions';
import { IChannel, IUser } from '@typings/db';
import fetcher from '@utils/fetcher';
import React, { FC, useCallback, useState } from 'react';
import { useParams } from 'react-router';
import useSWR from 'swr';

interface Props {
  channelData?: IChannel[];
  userData?: IUser;
}

const ChannelList: FC<Props> = () => {
  const { workspace } = useParams<{ workspace?: string }>();
  const [channelCollapse, setChannelCollapse] = useState(false);
  const [showBrowse, setShowBrowse] = useState(false);
  const { data: mentions } = useMentions(workspace);
  const { data: userData } = useSWR<IUser>('/api/users', fetcher, {
    dedupingInterval: 2000, // 2초
  });
  const { data: channelData } = useSWR<IChannel[]>(userData ? `/api/workspaces/${workspace}/channels` : null, fetcher);

  const toggleChannelCollapse = useCallback(() => {
    setChannelCollapse((prev) => !prev);
  }, []);

  return (
    <>
      <h2>
        <CollapseButton collapse={channelCollapse} onClick={toggleChannelCollapse}>
          <i
            className="c-icon p-channel_sidebar__section_heading_expand p-channel_sidebar__section_heading_expand--show_more_feature c-icon--caret-right c-icon--inherit c-icon--inline"
            data-qa="channel-section-collapse"
            aria-hidden="true"
          />
        </CollapseButton>
        <span>Channels</span>
      </h2>
      <div>
        {!channelCollapse &&
          channelData?.map((channel) => {
            return (
              <EachChannel key={channel.id} channel={channel} mentionCount={mentions?.unreadByChannel[channel.id]} />
            );
          })}
        {!channelCollapse && (
          <button
            type="button"
            onClick={() => setShowBrowse(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgb(188, 171, 188)',
              padding: '4px 16px 4px 36px',
              cursor: 'pointer',
              fontSize: 15,
              textAlign: 'left',
              width: '100%',
            }}
          >
            ＋ 채널 둘러보기
          </button>
        )}
      </div>
      <BrowseChannelsModal show={showBrowse} workspace={workspace} onCloseModal={() => setShowBrowse(false)} />
    </>
  );
};

export default ChannelList;
