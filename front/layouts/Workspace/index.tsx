import ChannelList from '@components/ChannelList';
import CreateChannelModal from '@components/CreateChannelModal';
import CreateWorkspaceModal from '@components/CreateWorkspaceModal';
import DMList from '@components/DMList';
import InviteWorkspaceModal from '@components/InviteWorkspaceModal';
import Menu from '@components/Menu';
import SearchModal from '@components/SearchModal';
import useSocket from '@hooks/useSocket';
import Channel from '@pages/Channel';
import DirectMessage from '@pages/DirectMessage';
import { IChannel, IUser } from '@typings/db';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import gravatar from 'gravatar';
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Link, Redirect, Route, Switch } from 'react-router-dom';
import { toast } from 'react-toastify';
import useSWR from 'swr';

import {
  AddButton,
  Channels,
  Chats,
  Header,
  MenuScroll,
  ProfileImg,
  RightMenu,
  WorkspaceButton,
  WorkspaceModal,
  WorkspaceName,
  Workspaces,
  WorkspaceWrapper,
} from './styles';

const Workspace = () => {
  const params = useParams<{ workspace?: string }>();
  // console.log('params', params, 'location', location, 'routeMatch', routeMatch, 'history', history);
  const { workspace } = params;
  const [socket, disconnectSocket] = useSocket(workspace);
  const { data: userData, mutate: revalidateUser } = useSWR<IUser | false>('/api/users', fetcher);
  const { data: channelData, mutate: revalidateChannels } = useSWR<IChannel[]>(
    userData ? `/api/workspaces/${workspace}/channels` : null,
    fetcher,
  );
  const [showCreateWorkspaceModal, setShowCreateWorkspaceModal] = useState(false);
  const [showInviteWorkspaceModal, setShowInviteWorkspaceModal] = useState(false);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);

  const onLogOut = useCallback(() => {
    axios
      .post('/api/users/logout')
      .then(() => {
        revalidateUser();
      })
      .catch((error) => {
        console.dir(error);
        toast.error(getErrorMessage(error), { position: 'bottom-center' });
      });
  }, []);

  const onClickCreateWorkspace = useCallback(() => {
    setShowCreateWorkspaceModal(true);
  }, []);

  const onClickAddChannel = useCallback(() => {
    setShowWorkspaceModal(false);
    setShowCreateChannelModal(true);
  }, []);

  const onClickInviteWorkspace = useCallback(() => {
    setShowWorkspaceModal(false);
    setShowInviteWorkspaceModal(true);
  }, []);

  const onCloseModal = useCallback(() => {
    setShowCreateWorkspaceModal(false);
    setShowCreateChannelModal(false);
    setShowInviteWorkspaceModal(false);
  }, []);

  const onClickUserProfile = useCallback(() => {
    setShowUserMenu((prev) => !prev);
  }, []);

  const toggleWorkspaceModal = useCallback(() => {
    setShowWorkspaceModal((prev) => !prev);
  }, []);

  useEffect(() => {
    return () => {
      console.info('disconnect socket', workspace);
      disconnectSocket();
    };
  }, [disconnectSocket, workspace]);
  useEffect(() => {
    if (channelData && userData) {
      console.info('로그인하자', socket);
      socket?.emit('login', { id: userData?.id, channels: channelData.map((v) => v.id) });
    }
  }, [socket, userData, channelData]);

  // 서버가 알려주는 멤버십 변경: 채널 초대, 워크스페이스 초대, 워크스페이스에서 내보내짐
  useEffect(() => {
    const onChannelsChanged = () => revalidateChannels();
    const onWorkspacesChanged = () => revalidateUser();
    const onRemoved = () => {
      toast.info('워크스페이스에서 내보내졌습니다.', { position: 'bottom-center' });
      revalidateUser();
    };
    socket?.on('channelsChanged', onChannelsChanged);
    socket?.on('workspacesChanged', onWorkspacesChanged);
    socket?.on('removedFromWorkspace', onRemoved);
    return () => {
      socket?.off('channelsChanged', onChannelsChanged);
      socket?.off('workspacesChanged', onWorkspacesChanged);
      socket?.off('removedFromWorkspace', onRemoved);
    };
  }, [socket, revalidateChannels, revalidateUser]);

  const currentWorkspace = userData ? userData.Workspaces.find((v) => v.url === workspace) : undefined;

  if (userData === false) {
    return <Redirect to="/login" />;
  }
  // 속하지 않은(내보내졌거나 없는) 워크스페이스 주소면 내 첫 워크스페이스로 보낸다
  if (userData && !currentWorkspace) {
    const first = userData.Workspaces[0];
    if (first) {
      return <Redirect to={`/workspace/${first.url}/channel/일반`} />;
    }
  }

  return (
    <div>
      <Header>
        {userData && <SearchModal workspace={workspace} myId={userData.id} />}
        {userData && (
          <RightMenu>
            <span onClick={onClickUserProfile}>
              <ProfileImg src={gravatar.url(userData.email, { s: '28px', d: 'retro' })} alt={userData.nickname} />
            </span>
            {showUserMenu && (
              <Menu
                style={{ right: 8, top: 42, minWidth: 0 }}
                show={showUserMenu}
                onCloseModal={onClickUserProfile}
                closeButton={false}
              >
                <WorkspaceModal>
                  <header>
                    <img className="ws-icon" src={gravatar.url(userData.email, { s: '72px', d: 'retro' })} alt="" />
                    <div>
                      <strong>{userData.nickname}</strong>
                      <small>{userData.email}</small>
                      <small className="online">● 온라인</small>
                    </div>
                  </header>
                  <ul role="menu">
                    <li>
                      <button type="button" role="menuitem" className="danger" onClick={onLogOut}>
                        로그아웃
                      </button>
                    </li>
                  </ul>
                </WorkspaceModal>
              </Menu>
            )}
          </RightMenu>
        )}
      </Header>
      <WorkspaceWrapper>
        <Workspaces>
          {userData?.Workspaces.map((ws) => {
            const isActive = ws.url === workspace;
            return (
              <Link
                key={ws.id}
                to={`/workspace/${ws.url}/channel/일반`}
                title={ws.name}
                aria-label={`${ws.name} 워크스페이스`}
                aria-current={isActive ? 'page' : undefined}
              >
                <WorkspaceButton as="span" className={isActive ? 'active' : undefined}>
                  {ws.name.slice(0, 1).toUpperCase()}
                </WorkspaceButton>
              </Link>
            );
          })}
          <AddButton onClick={onClickCreateWorkspace} title="워크스페이스 만들기" aria-label="워크스페이스 만들기">
            +
          </AddButton>
        </Workspaces>
        <Channels>
          <WorkspaceName onClick={toggleWorkspaceModal}>
            {userData?.Workspaces.find((v) => v.url === workspace)?.name}
          </WorkspaceName>
          <MenuScroll>
            <Menu
              show={showWorkspaceModal}
              onCloseModal={toggleWorkspaceModal}
              style={{ top: 100, left: 76, minWidth: 0 }}
              closeButton={false}
            >
              <WorkspaceModal>
                <header>
                  <span className="ws-icon">{currentWorkspace?.name.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <strong>{currentWorkspace?.name}</strong>
                    <small>{currentWorkspace?.url}</small>
                  </div>
                </header>
                <ul role="menu">
                  <li>
                    <button type="button" role="menuitem" onClick={onClickInviteWorkspace}>
                      워크스페이스에 사용자 초대
                    </button>
                  </li>
                  <li>
                    <button type="button" role="menuitem" onClick={onClickAddChannel}>
                      채널 만들기
                    </button>
                  </li>
                  <li className="divider" role="separator" />
                  <li>
                    <button type="button" role="menuitem" className="danger" onClick={onLogOut}>
                      {userData?.nickname ? `${userData.nickname} 로그아웃` : '로그아웃'}
                    </button>
                  </li>
                </ul>
              </WorkspaceModal>
            </Menu>
            <ChannelList />
            <DMList />
          </MenuScroll>
        </Channels>
        <Chats>
          <Switch>
            <Route path="/workspace/:workspace/channel/:channel" component={Channel} />
            <Route path="/workspace/:workspace/dm/:id" component={DirectMessage} />
          </Switch>
        </Chats>
      </WorkspaceWrapper>
      <CreateWorkspaceModal show={showCreateWorkspaceModal} onCloseModal={onCloseModal} />
      <CreateChannelModal
        show={showCreateChannelModal}
        onCloseModal={onCloseModal}
        setShowCreateChannelModal={setShowCreateChannelModal}
      />
      <InviteWorkspaceModal
        show={showInviteWorkspaceModal}
        onCloseModal={onCloseModal}
        setShowInviteWorkspaceModal={setShowInviteWorkspaceModal}
      />
    </div>
  );
};

export default Workspace;
