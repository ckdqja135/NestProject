import EachDM from '@components/EachDM';
import useOnlineList from '@hooks/useOnlineList';
import useSidebarPins from '@hooks/useSidebarPins';
import { CollapseButton } from '@components/DMList/styles';
import { IUser, IUserWithOnline } from '@typings/db';
import fetcher from '@utils/fetcher';
import React, { useCallback, useState } from 'react';
import { useParams } from 'react-router';
import useSWR from 'swr';
import useSidebarSections from '@hooks/useSidebarSections';
import SidebarItem from '@components/SidebarSections/SidebarItem';
import { useDropBack } from '@components/SidebarSections';

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
  // 내가 만든 섹션에 넣은 DM 은 그 섹션에만 보인다
  const { sectionOf } = useSidebarSections(workspace);
  const dropBack = useDropBack();

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
        <span>Direct Messages</span>
      </h2>
      <div>
        {!channelCollapse &&
          memberData
            ?.filter((member) => !isPinned('dm', member.id) && sectionOf('dm', member.id) === null)
            .map((member) => {
              const isOnline = onlineList.includes(member.id);
              return (
                <SidebarItem key={member.id} kind="dm" id={member.id} label={member.nickname}>
                  <EachDM member={member} isOnline={isOnline} />
                </SidebarItem>
              );
            })}
      </div>
    </>
  );
};

export default DMList;
