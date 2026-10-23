import { CollapseButton } from '@components/DMList/styles';
import BrowseChannelsModal from '@components/BrowseChannelsModal';
import EachChannel from '@components/EachChannel';
import useMentions from '@hooks/useMentions';
import useMyRole from '@hooks/useMyRole';
import useSidebarPins from '@hooks/useSidebarPins';
import { IChannel, IUser } from '@typings/db';
import fetcher from '@utils/fetcher';
import React, { FC, useCallback, useState } from 'react';
import { useParams } from 'react-router';
import useSWR from 'swr';
import useSidebarSections from '@hooks/useSidebarSections';
import SidebarItem from '@components/SidebarSections/SidebarItem';
import { useDropBack } from '@components/SidebarSections';

interface Props {
  channelData?: IChannel[];
  userData?: IUser;
}

const ChannelList: FC<Props> = () => {
  const { workspace } = useParams<{ workspace?: string }>();
  // 게스트는 초대받은 채널만 본다 (둘러보기 없음)
  const isGuest = useMyRole(workspace) === 'guest';
  const [channelCollapse, setChannelCollapse] = useState(false);
  const [showBrowse, setShowBrowse] = useState(false);
  const { data: mentions } = useMentions(workspace);
  // 맨 위에 고정한 채널은 '고정됨' 에만 보인다
  const { isPinned } = useSidebarPins(workspace);
  // 내가 만든 섹션에 넣은 채널은 그 섹션에만 보인다
  const { sectionOf } = useSidebarSections(workspace);
  const dropBack = useDropBack();
  const { data: userData } = useSWR<IUser>('/api/users', fetcher, {
    dedupingInterval: 2000, // 2초
  });
  const { data: channelData } = useSWR<IChannel[]>(userData ? `/api/workspaces/${workspace}/channels` : null, fetcher);

  const toggleChannelCollapse = useCallback(() => {
    setChannelCollapse((prev) => !prev);
  }, []);

  return (
    <>
      <h2 {...dropBack}>
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
          channelData
            ?.filter((channel) => !isPinned('channel', channel.id) && sectionOf('channel', channel.id) === null)
            .map((channel) => {
              return (
                <SidebarItem key={channel.id} kind="channel" id={channel.id} label={channel.name}>
                  <EachChannel channel={channel} mentionCount={mentions?.unreadByChannel[channel.id]} />
                </SidebarItem>
              );
            })}
        {!channelCollapse && !isGuest && (
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
