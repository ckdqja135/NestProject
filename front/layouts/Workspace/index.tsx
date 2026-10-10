import ChannelList from '@components/ChannelList';
import CreateChannelModal from '@components/CreateChannelModal';
import CreateWorkspaceModal from '@components/CreateWorkspaceModal';
import DMList from '@components/DMList';
import InviteWorkspaceModal from '@components/InviteWorkspaceModal';
import MembersModal from '@components/MembersModal';
import MentionsButton from '@components/MentionsButton';
import Menu from '@components/Menu';
import SearchModal from '@components/SearchModal';
import useSocket from '@hooks/useSocket';
import Channel from '@pages/Channel';
import DirectMessage from '@pages/DirectMessage';
import { IChannel, IChat, IDM, IUser } from '@typings/db';
import fetcher from '@utils/fetcher';
import { notifyIfHidden, previewText } from '@utils/notify';
import { FileMeta, getFile, notifyUnavailable, putFile, UnavailableReason } from '@utils/fileStore';
import StorageModal from '@components/StorageModal';
import ProfileModal from '@components/ProfileModal';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import { avatarUrl } from '@utils/avatar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Link, Redirect, Route, Switch, useHistory, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import useSWR, { mutate } from 'swr';

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
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const history = useHistory();
  const location = useLocation();
  const locationRef = useRef(location.pathname);
  locationRef.current = decodeURIComponent(location.pathname);
  const { mutate: revalidateMembers } = useSWR<IUser[]>(
    userData ? `/api/workspaces/${workspace}/members` : null,
    fetcher,
  );

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
    const onRemoved = (data?: { reason?: string }) => {
      // 스스로 나간 경우는 멤버 화면에서 이미 알렸다
      if (data?.reason !== 'left') {
        toast.info('워크스페이스에서 내보내졌습니다.', { position: 'bottom-center' });
      }
      revalidateUser();
    };
    const onMembersChanged = () => revalidateMembers();
    // 누군가 닉네임/프로필 그림을 바꿈: 멤버 목록·DM 상대 정보를 다시 불러온다 (내 정보면 내 정보도)
    const onProfileUpdated = (user: IUser) => {
      revalidateMembers();
      mutate(`/api/workspaces/${workspace}/users/${user.id}`);
      if (userData && user.id === userData.id) {
        revalidateUser();
      }
    };
    socket?.on('channelsChanged', onChannelsChanged);
    socket?.on('workspacesChanged', onWorkspacesChanged);
    socket?.on('removedFromWorkspace', onRemoved);
    socket?.on('membersChanged', onMembersChanged);
    socket?.on('profileUpdated', onProfileUpdated);
    return () => {
      socket?.off('profileUpdated', onProfileUpdated);
      socket?.off('channelsChanged', onChannelsChanged);
      socket?.off('workspacesChanged', onWorkspacesChanged);
      socket?.off('removedFromWorkspace', onRemoved);
      socket?.off('membersChanged', onMembersChanged);
    };
  }, [socket, workspace, userData, revalidateChannels, revalidateUser, revalidateMembers]);

  // 서버가 중계한 파일을 이 기기의 브라우저 저장소에 보관한다 (서버에는 저장되지 않음)
  useEffect(() => {
    const onFileData = ({ data, ...meta }: FileMeta & { data: ArrayBuffer }) => {
      putFile(meta, new Blob([data], { type: meta.type })).catch((error) =>
        console.error('파일을 기기에 저장하지 못했습니다.', error),
      );
    };
    // 다른 사람이 내가 보낸 파일을 받지 못했다며 다시 보내 달라고 요청: 내 기기 저장소에서 꺼내 중계 서버로 보낸다
    const onFileRequested = async ({ fileId, requesterId }: { fileId: string; requesterId: number }) => {
      const stored = await getFile(fileId).catch(() => undefined);
      if (!stored) {
        socket?.emit('fileMissing', { fileId, requesterId });
        return;
      }
      const formData = new FormData();
      formData.append('file', new File([stored.blob], stored.name, { type: stored.type }));
      formData.append('fileId', fileId);
      formData.append('requesterId', String(requesterId));
      axios.post(`/api/workspaces/${workspace}/files/relay`, formData).catch((error) => {
        console.error('파일을 다시 보내지 못했습니다.', error);
        socket?.emit('fileMissing', { fileId, requesterId });
      });
    };
    const onFileUnavailable = ({ fileId, reason }: { fileId: string; reason: UnavailableReason }) =>
      notifyUnavailable(fileId, reason);
    socket?.on('fileData', onFileData);
    socket?.on('fileRequested', onFileRequested);
    socket?.on('fileUnavailable', onFileUnavailable);
    return () => {
      socket?.off('fileData', onFileData);
      socket?.off('fileRequested', onFileRequested);
      socket?.off('fileUnavailable', onFileUnavailable);
    };
  }, [socket, workspace]);

  // 멘션/DM 알림: 탭을 보고 있지 않으면 브라우저 알림, 보고 있지만 다른 대화면 토스트(멘션)
  useEffect(() => {
    const onMention = ({ chat }: { chat: IChat }) => {
      const channelPath = `/workspace/${workspace}/channel/${chat.Channel.name}`;
      const title = `${chat.User.nickname}님이 #${chat.Channel.name}에서 멘션했습니다`;
      const go = () => history.push(channelPath);
      if (document.visibilityState !== 'visible') {
        notifyIfHidden(title, previewText(chat.content), go);
      } else if (locationRef.current !== channelPath) {
        toast.info(`${title}: ${previewText(chat.content)}`, { position: 'bottom-center', onClick: go });
      }
    };
    const onDM = (dm: IDM) => {
      if (!userData || dm.SenderId === userData.id) {
        return;
      }
      notifyIfHidden(`${dm.Sender.nickname}님의 메시지`, previewText(dm.content), () =>
        history.push(`/workspace/${workspace}/dm/${dm.SenderId}`),
      );
    };
    socket?.on('mention', onMention);
    socket?.on('dm', onDM);
    return () => {
      socket?.off('mention', onMention);
      socket?.off('dm', onDM);
    };
  }, [socket, workspace, history, userData]);

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
        {userData && workspace && <MentionsButton workspace={workspace} />}
        {userData && (
          <RightMenu>
            <button
              type="button"
              onClick={onClickUserProfile}
              aria-label="내 프로필 메뉴"
              aria-haspopup="menu"
              aria-expanded={showUserMenu}
              // 이미지가 아니라 버튼이 자리를 차지해야 키보드/스크린리더에서도 누를 수 있다
              style={{
                position: 'absolute',
                top: 5,
                right: 16,
                width: 28,
                height: 28,
                border: 'none',
                background: 'none',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              <ProfileImg src={avatarUrl(userData, 28)} alt="" style={{ position: 'static' }} />
            </button>
            {showUserMenu && (
              <Menu
                style={{ right: 8, top: 42, minWidth: 0 }}
                show={showUserMenu}
                onCloseModal={onClickUserProfile}
                closeButton={false}
              >
                <WorkspaceModal>
                  <header>
                    <img className="avatar" src={avatarUrl(userData, 72)} alt="" />
                    <div>
                      <strong>{userData.nickname}</strong>
                      <small>{userData.email}</small>
                      <small className="online">● 온라인</small>
                    </div>
                  </header>
                  <ul role="menu">
                    <li>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowProfileModal(true);
                        }}
                      >
                        프로필 설정
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowStorageModal(true);
                        }}
                      >
                        이 기기의 파일
                      </button>
                    </li>
                    <li className="divider" role="separator" />
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
          <WorkspaceName onClick={toggleWorkspaceModal} aria-haspopup="menu" aria-expanded={showWorkspaceModal}>
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
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowWorkspaceModal(false);
                        setShowMembersModal(true);
                      }}
                    >
                      멤버 보기 · 관리
                    </button>
                  </li>
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
      <StorageModal show={showStorageModal} onCloseModal={() => setShowStorageModal(false)} />
      {userData && (
        <ProfileModal
          show={showProfileModal}
          me={userData}
          onCloseModal={() => setShowProfileModal(false)}
          onUpdated={() => revalidateUser()}
        />
      )}
      {currentWorkspace && userData && (
        <MembersModal
          show={showMembersModal}
          onCloseModal={() => setShowMembersModal(false)}
          workspace={currentWorkspace}
          me={userData}
          onInvite={() => {
            setShowMembersModal(false);
            setShowInviteWorkspaceModal(true);
          }}
        />
      )}
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
