import EachDM from '@components/EachDM';
import useOnlineList from '@hooks/useOnlineList';
import useSidebarPins from '@hooks/useSidebarPins';
import { CollapseButton } from '@components/DMList/styles';
import { IUser, IUserWithOnline } from '@typings/db';
import fetcher from '@utils/fetcher';
import React, { useCallback, useState } from 'react';
import { useParams } from 'react-router';
import useSWR from 'swr';

const DMList = () => {
  const { workspace } = useParams<{ workspace?: string }>();
  const { data: userData } = useSWR<IUser>('/api/users', fetcher, {
    dedupingInterval: 2000, // 2초
  });
  const { data: memberData } = useSWR<IUserWithOnline[]>(
    userData ? `/api/workspaces/${workspace}/members` : null,
    fetcher,
  );
  const [channelCollapse, setChannelCollapse] = useState(false);
  const onlineList = useOnlineList(workspace);
  // 맨 위에 고정한 DM 은 '고정됨' 에만 보인다
  const { isPinned } = useSidebarPins(workspace);

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
        <span>Direct Messages</span>
      </h2>
      <div>
        {!channelCollapse &&
          memberData
            ?.filter((member) => !isPinned('dm', member.id))
            .map((member) => {
              const isOnline = onlineList.includes(member.id);
              return <EachDM key={member.id} member={member} isOnline={isOnline} />;
            })}
      </div>
    </>
  );
};

export default DMList;
