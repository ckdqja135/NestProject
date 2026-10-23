import ChannelList from '@components/ChannelList';
import CreateChannelModal from '@components/CreateChannelModal';
import CreateWorkspaceModal from '@components/CreateWorkspaceModal';
import DMList from '@components/DMList';
import HuddleProvider from '@components/Huddle/HuddleProvider';
import PinnedList from '@components/PinnedList';
import InviteWorkspaceModal from '@components/InviteWorkspaceModal';
import MembersModal from '@components/MembersModal';
import AppsModal from '@components/AppsModal';
import MentionsButton from '@components/MentionsButton';
import SavedButton from '@components/SavedButton';
import ThreadsButton from '@components/ThreadsButton';
import QuickSwitcher from '@components/QuickSwitcher';
import ShortcutsModal from '@components/ShortcutsModal';
import ScheduledModal from '@components/ScheduledModal';
import GroupsModal from '@components/GroupsModal';
import CustomEmojiModal from '@components/CustomEmojiModal';
import useCustomEmojis from '@hooks/useCustomEmojis';
import useMyRole, { isAdminRole } from '@hooks/useMyRole';
import DndModal from '@components/DndModal';
import { DndSchedule, isQuietNow, parseDnd, setMyDnd } from '@utils/dnd';
import { disablePush, enablePush } from '@utils/push';
import Menu from '@components/Menu';
import SearchModal from '@components/SearchModal';
import useSocket from '@hooks/useSocket';
import Channel from '@pages/Channel';
import DirectMessage from '@pages/DirectMessage';
import Contacts from '@pages/Contacts';
import Docs from '@pages/Docs';
import Calendar from '@pages/Calendar';
import Design from '@pages/Design';
import { IChannel, IChat, IDM, IUser, IWorkspace } from '@typings/db';
import fetcher from '@utils/fetcher';
import {
  notificationPermission,
  notificationsPaused,
  notifyIfHidden,
  previewText,
  requestNotificationPermission,
  setNotificationsPaused,
} from '@utils/notify';
import useUnreadTitle from '@hooks/useUnreadTitle';
import { applyReadMarker, refreshSidebar, registerChannels } from '@utils/readState';
import { applyServerDrafts } from '@hooks/useDraft';
import { getThemePref, setThemePref, THEME_LABELS, ThemePref } from '@utils/theme';
import { FileMeta, getFile, notifyUnavailable, putFile, UnavailableReason } from '@utils/fileStore';
import StorageModal from '@components/StorageModal';
import ProfileModal from '@components/ProfileModal';
import StatusModal from '@components/StatusModal';
import WorkspaceSettingsModal from '@components/WorkspaceSettingsModal';
import CallProvider from '@components/Call/CallProvider';
import { moveChannelKeys, moveWorkspaceKeys } from '@utils/storageKeys';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import {
  Bell,
  BellOff,
  BookUser,
  CalendarDays,
  FileText,
  Menu as MenuIcon,
  MessageSquare,
  PenTool,
  SunMoon,
} from 'lucide-react';
import { avatarUrl } from '@utils/avatar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Link, Redirect, Route, Switch, useHistory, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import useSWR, { mutate } from 'swr';

import {
  AddButton,
  AppNav,
  Channels,
  Chats,
  Header,
  MenuScroll,
  NavBackdrop,
  NavToggle,
  ProfileImg,
  RightMenu,
  WorkspaceButton,
  WorkspaceModal,
  WorkspaceName,
  Workspaces,
  WorkspaceWrapper,
} from './styles';
import SidebarSections from '@components/SidebarSections';
import TasksButton from '@components/TasksButton';

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
  const [showApps, setShowApps] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  // 방해 금지 시간 (계정 설정, 모든 기기 공통)
  const [showDnd, setShowDnd] = useState(false);
  const [dnd, setDnd] = useState<DndSchedule | null>(null);
  const applyDnd = useCallback((raw: string | null | undefined) => {
    const schedule = parseDnd(raw);
    setMyDnd(schedule);
    setDnd(schedule);
  }, []);
  const [showWorkspaceSettings, setShowWorkspaceSettings] = useState(false);
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const [theme, setTheme] = useState<ThemePref>(getThemePref);
  // 시스템 설정 따르기 → 라이트 → 다크 순서로 바꾼다
  const onCycleTheme = useCallback(() => {
    const next: ThemePref = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    setThemePref(next);
    setTheme(next);
    // 계정에도 저장해서 다른 기기에서도 같은 테마로
    axios.patch('/api/users/me/preferences', { theme: next }).catch(() => undefined);
  }, [theme]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showScheduled, setShowScheduled] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  // 커스텀 이모지 목록을 미리 받아 둔다 (메시지가 캐시를 읽어 :이름: 을 그림으로)
  useCustomEmojis(workspace);

  // 전역 단축키: Ctrl/⌘+K 빠른 이동, Ctrl/⌘+/ 단축키 보기
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) {
        return;
      }
      if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowShortcuts(false);
        setShowQuickSwitcher((v) => !v);
      } else if (e.key === '/') {
        e.preventDefault();
        setShowQuickSwitcher(false);
        setShowShortcuts((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  const [paused, setPaused] = useState(notificationsPaused);
  useUnreadTitle();
  const history = useHistory();
  const location = useLocation();
  // 휴대폰 화면: 채널 목록 서랍. 다른 채널/DM 으로 이동하면 닫는다
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);
  const locationRef = useRef(location.pathname);
  locationRef.current = decodeURIComponent(location.pathname);
  // 지금 보고 있는 화면 (왼쪽 메뉴). 메신저로 돌아가면 마지막으로 보던 채널·DM 을 연다
  const sectionMatch = location.pathname.match(/^\/workspace\/[^/]+\/(docs|design|calendar|contacts)(\/|$)/);
  const section = sectionMatch ? sectionMatch[1] : 'messenger';
  const lastMessengerPath = useRef<{ workspace?: string; path: string }>({ path: '' });
  if (section === 'messenger' && /\/(channel|dm)\//.test(location.pathname)) {
    lastMessengerPath.current = { workspace, path: location.pathname };
  }
  const messengerPath =
    lastMessengerPath.current.workspace === workspace && lastMessengerPath.current.path
      ? lastMessengerPath.current.path
      : `/workspace/${workspace}/channel/일반`;
  const { data: membersData, mutate: revalidateMembers } = useSWR<IUser[]>(
    userData ? `/api/workspaces/${workspace}/members` : null,
    fetcher,
  );
  const membersRef = useRef(membersData);
  membersRef.current = membersData;

  const onLogOut = useCallback(() => {
    // 다음에 이 브라우저를 쓰는 사람이 내 푸시 알림을 받지 않게 먼저 끊는다
    disablePush()
      .catch(() => undefined)
      .then(() => axios.post('/api/users/logout'))
      .then(() => {
        revalidateUser();
      })
      .catch((error) => {
        console.dir(error);
        toast.error(getErrorMessage(error), { position: 'bottom-center' });
      });
  }, [revalidateUser]);

  const onClickCreateWorkspace = useCallback(() => {
    setShowCreateWorkspaceModal(true);
  }, []);

  // 이 워크스페이스에서 내 역할 (게스트에게는 초대·채널 만들기를 숨긴다)
  const myRole = useMyRole(workspace);

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

  // 워크스페이스 주소가 바뀌면: 캐시의 주소를 먼저 바꾼 뒤(모르는 주소로 보고 첫 워크스페이스로 보내지 않게) 새 주소로 옮긴다
  // 옮기는 동안에는 '모르는 워크스페이스 → 첫 워크스페이스로' 이동을 하지 않는다
  const movingWorkspaceRef = useRef<string[]>([]);
  const moveToWorkspaceUrl = useCallback(
    (oldUrl: string, newUrl: string) => {
      moveWorkspaceKeys(oldUrl, newUrl);
      movingWorkspaceRef.current = [oldUrl, newUrl];
      if (locationRef.current.startsWith(`/workspace/${oldUrl}/`)) {
        history.replace(locationRef.current.replace(`/workspace/${oldUrl}/`, `/workspace/${newUrl}/`));
      }
      return revalidateUser(
        (prev) =>
          prev
            ? { ...prev, Workspaces: prev.Workspaces.map((w) => (w.url === oldUrl ? { ...w, url: newUrl } : w)) }
            : prev,
        false,
      )
        .then(() => revalidateUser())
        .finally(() => {
          movingWorkspaceRef.current = [];
        });
    },
    [revalidateUser, history],
  );

  // 기기 간 동기화: 들어올 때와 창으로 돌아올 때 서버의 읽은 위치·임시 저장 글을 받아 이 기기에 반영한다
  useEffect(() => {
    if (!workspace || !userData || !channelData) {
      return undefined;
    }
    registerChannels(workspace, channelData);
    const load = () =>
      axios
        .get<{ readMarkers: Record<string, number>; drafts: Record<string, { content: string; at: number }> }>(
          `/api/workspaces/${workspace}/sync`,
        )
        .then(({ data }) => {
          Object.entries(data.readMarkers).forEach(([key, at]) => applyReadMarker(workspace, key, at));
          applyServerDrafts(workspace, data.drafts);
          refreshSidebar();
        })
        .catch(() => undefined);
    load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [workspace, userData, channelData]);

  // 다른 기기에서 읽은 위치·설정이 바뀌면 바로 반영
  useEffect(() => {
    const onReadMarker = ({ key, at }: { key: string; at: number }) => workspace && applyReadMarker(workspace, key, at);
    const onPreferences = (prefs: {
      theme: ThemePref | null;
      notificationsPaused: boolean;
      dndSchedule?: string | null;
    }) => {
      if (prefs.theme) {
        setThemePref(prefs.theme);
        setTheme(prefs.theme);
      }
      setNotificationsPaused(prefs.notificationsPaused);
      setPaused(prefs.notificationsPaused);
      if (prefs.dndSchedule !== undefined) applyDnd(prefs.dndSchedule);
    };
    socket?.on('readMarker', onReadMarker);
    socket?.on('preferencesChanged', onPreferences);
    return () => {
      socket?.off('readMarker', onReadMarker);
      socket?.off('preferencesChanged', onPreferences);
    };
  }, [socket, workspace, applyDnd]);

  // 로그인하면 계정에 저장된 설정을 이 기기에 적용 (처음이면 이 기기 설정을 계정에 올린다)
  const appliedPrefsFor = useRef<number | null>(null);
  useEffect(() => {
    if (!userData || appliedPrefsFor.current === userData.id) {
      return;
    }
    appliedPrefsFor.current = userData.id;
    if (userData.theme) {
      setThemePref(userData.theme);
      setTheme(userData.theme);
    } else {
      axios.patch('/api/users/me/preferences', { theme: getThemePref() }).catch(() => undefined);
    }
    if (typeof userData.notificationsPaused === 'boolean') {
      setNotificationsPaused(userData.notificationsPaused);
      setPaused(userData.notificationsPaused);
    }
    applyDnd(userData.dndSchedule);
    // 알림 권한이 있으면 이 브라우저로 푸시도 받는다 (탭을 모두 닫아도 멘션·DM 알림)
    if (notificationPermission() === 'granted') enablePush().catch(() => undefined);
  }, [userData, applyDnd]);

  // 푸시 알림을 누르면 서비스 워커가 이 창으로 그 메시지 주소를 보낸다
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'shlack-open') return;
      const target = new URL(event.data.url, window.location.origin);
      if (target.origin === window.location.origin) history.push(`${target.pathname}${target.search}`);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [history]);

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
    // 채널 이름/주제/보관 상태가 바뀜: 목록을 다시 받고, 보고 있던 채널 이름이 바뀌었으면 새 주소로 옮긴다
    const onChannelUpdated = (channel: IChannel & { oldName: string }) => {
      if (workspace && channel.oldName !== channel.name) {
        moveChannelKeys(workspace, channel.oldName, channel.name);
      }
      revalidateChannels().then(() => {
        const oldPath = `/workspace/${workspace}/channel/${channel.oldName}`;
        if (channel.oldName !== channel.name && locationRef.current === oldPath) {
          history.replace(`/workspace/${workspace}/channel/${channel.name}`);
        }
      });
    };
    const onChannelDeleted = (channel: { id: number; name: string }) => {
      revalidateChannels().then(() => {
        if (locationRef.current === `/workspace/${workspace}/channel/${channel.name}`) {
          toast.info(`#${channel.name} 채널이 삭제되었습니다.`, { position: 'bottom-center' });
          history.push(`/workspace/${workspace}/channel/일반`);
        }
      });
    };
    // 워크스페이스 이름/주소/소유자가 바뀜: 주소가 바뀌었으면 새 주소로 옮긴다
    const onWorkspaceUpdated = (data: IWorkspace & { oldUrl: string }) => {
      if (data.url !== data.oldUrl) {
        const viewing = locationRef.current.startsWith(`/workspace/${data.oldUrl}/`);
        moveToWorkspaceUrl(data.oldUrl, data.url).then(() => {
          if (viewing) {
            toast.info(`워크스페이스 주소가 /workspace/${data.url} 로 바뀌었습니다.`, { position: 'bottom-center' });
          }
        });
      } else {
        revalidateUser();
      }
    };
    socket?.on('channelUpdated', onChannelUpdated);
    socket?.on('channelDeleted', onChannelDeleted);
    socket?.on('workspaceUpdated', onWorkspaceUpdated);
    socket?.on('channelsChanged', onChannelsChanged);
    socket?.on('workspacesChanged', onWorkspacesChanged);
    socket?.on('removedFromWorkspace', onRemoved);
    socket?.on('membersChanged', onMembersChanged);
    socket?.on('profileUpdated', onProfileUpdated);
    return () => {
      socket?.off('profileUpdated', onProfileUpdated);
      socket?.off('channelUpdated', onChannelUpdated);
      socket?.off('channelDeleted', onChannelDeleted);
      socket?.off('workspaceUpdated', onWorkspaceUpdated);
      socket?.off('channelsChanged', onChannelsChanged);
      socket?.off('workspacesChanged', onWorkspacesChanged);
      socket?.off('removedFromWorkspace', onRemoved);
      socket?.off('membersChanged', onMembersChanged);
    };
  }, [socket, workspace, userData, revalidateChannels, revalidateUser, revalidateMembers, history, moveToWorkspaceUrl]);

  // 누군가 나에게 문서를 공유하면 알린다 (누르면 문서를 연다)
  useEffect(() => {
    const onDocShared = (data: { id: number; title: string; role: 'view' | 'edit' }) => {
      toast.info(`'${data.title}' 문서를 ${data.role === 'edit' ? '고칠' : '볼'} 수 있게 공유받았습니다.`, {
        position: 'bottom-center',
        onClick: () => history.push(`/workspace/${workspace}/docs/d/${data.id}`),
      });
    };
    socket?.on('docShared', onDocShared);
    return () => {
      socket?.off('docShared', onDocShared);
    };
  }, [socket, workspace, history]);

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
      const title = `${chat.User?.nickname || chat.botName}님이 #${chat.Channel.name}에서 멘션했습니다`;
      // 알림을 누르면 그 메시지로 이동 (스레드 답글이면 스레드를 열어서)
      const query = chat.ParentId ? `message=${chat.ParentId}&reply=${chat.id}` : `message=${chat.id}`;
      const go = () => history.push(`${channelPath}?${query}`);
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
        history.push(`/workspace/${workspace}/dm/${dm.SenderId}?message=${dm.id}`),
      );
    };
    // 리마인더: 정한 시각이 되면 그 메시지를 다시 알려준다 (누르면 그 메시지로 이동)
    const onReminder = ({ chat, dm }: { chat: IChat | null; dm: IDM | null }) => {
      const message = chat || dm;
      if (!message) {
        return;
      }
      const path = chat
        ? `/workspace/${workspace}/channel/${chat.Channel.name}?${
            chat.ParentId ? `message=${chat.ParentId}&reply=${chat.id}` : `message=${chat.id}`
          }`
        : `/workspace/${workspace}/dm/${
            userData && dm!.SenderId === userData.id ? dm!.ReceiverId : dm!.SenderId
          }?message=${dm!.id}`;
      const go = () => history.push(path);
      const title = '⏰ 리마인더';
      toast.info(`${title}: ${previewText(message.content)}`, {
        position: 'top-right',
        autoClose: false,
        onClick: go,
      });
      notifyIfHidden(title, previewText(message.content), go);
    };
    // 예약 메시지를 보내지 못함 (채널을 나갔거나 보관됨 등)
    const onScheduledFailed = ({ content, reason }: { content: string; reason: string }) => {
      toast.error(`예약한 메시지를 보내지 못했습니다: ${reason} (${previewText(content)})`, {
        position: 'bottom-center',
        autoClose: false,
      });
    };
    socket?.on('mention', onMention);
    socket?.on('dm', onDM);
    socket?.on('reminder', onReminder);
    socket?.on('scheduledFailed', onScheduledFailed);
    // 내 문서·내가 참여한 댓글 스레드에 새 댓글
    const onDocComment = ({
      docId,
      title,
      authorId,
      content,
    }: {
      docId: number;
      title: string;
      authorId: number;
      content: string;
    }) => {
      const author = membersRef.current?.find((m) => m.id === authorId)?.nickname || '누군가';
      const path = `/workspace/${workspace}/docs/d/${docId}?comments=1`;
      const text = `${author}님이 ‘${title}’에 댓글: ${content}`;
      const go = () => history.push(path);
      if (document.visibilityState !== 'visible') {
        notifyIfHidden(`${author}님의 댓글`, `‘${title}’: ${content}`, go);
      } else if (!locationRef.current.endsWith(`/docs/d/${docId}`)) {
        toast.info(text, { position: 'bottom-center', onClick: go });
      }
    };
    socket?.on('docComment', onDocComment);
    return () => {
      socket?.off('docComment', onDocComment);
      socket?.off('reminder', onReminder);
      socket?.off('scheduledFailed', onScheduledFailed);
      socket?.off('mention', onMention);
      socket?.off('dm', onDM);
    };
  }, [socket, workspace, history, userData]);

  const onToggleAway = useCallback(() => {
    if (!userData) {
      return;
    }
    setShowUserMenu(false);
    axios
      .patch('/api/users/me', { away: !userData.away })
      .then(() => revalidateUser())
      .catch((error) => toast.error(getErrorMessage(error), { position: 'bottom-center' }));
  }, [userData, revalidateUser]);

  // 데스크톱 알림: 권한이 없으면 권한을 요청하고, 있으면 슐랙 안에서 일시 중지/다시 켜기
  const permission = notificationPermission();
  const onToggleNotifications = useCallback(() => {
    setShowUserMenu(false);
    if (permission === 'default') {
      requestNotificationPermission().then((result) => {
        if (result === 'granted') {
          setNotificationsPaused(false);
          setPaused(false);
          enablePush().catch(() => undefined);
          axios.patch('/api/users/me/preferences', { notificationsPaused: false }).catch(() => undefined);
          toast.success('데스크톱 알림을 켰습니다.', { position: 'bottom-center' });
        }
      });
      return;
    }
    if (permission !== 'granted') {
      toast.info('브라우저 설정에서 이 사이트의 알림을 허용해 주세요.', { position: 'bottom-center' });
      return;
    }
    setNotificationsPaused(!paused);
    setPaused(!paused);
    axios.patch('/api/users/me/preferences', { notificationsPaused: !paused }).catch(() => undefined);
    toast.info(paused ? '데스크톱 알림을 다시 켰습니다.' : '데스크톱 알림을 일시 중지했습니다.', {
      position: 'bottom-center',
    });
  }, [permission, paused]);
  const notificationMenuLabel =
    permission === 'granted' ? (
      paused ? (
        <>
          <Bell size={15} /> 데스크톱 알림 다시 켜기
        </>
      ) : (
        <>
          <BellOff size={15} /> 데스크톱 알림 일시 중지
        </>
      )
    ) : (
      <>
        <Bell size={15} /> 데스크톱 알림 켜기
      </>
    );

  const currentWorkspace = userData ? userData.Workspaces.find((v) => v.url === workspace) : undefined;

  if (userData === false) {
    return <Redirect to="/login" />;
  }
  // 속하지 않은(내보내졌거나 없는) 워크스페이스 주소면 내 첫 워크스페이스로 보낸다
  if (userData && !currentWorkspace && !(workspace && movingWorkspaceRef.current.includes(workspace))) {
    const first = userData.Workspaces[0];
    if (first) {
      return <Redirect to={`/workspace/${first.url}/channel/일반`} />;
    }
  }

  return (
    <CallProvider socket={socket} members={membersData}>
      <HuddleProvider socket={socket} me={userData || undefined} members={membersData}>
        <Header>
          <NavToggle
            type="button"
            onClick={() => setNavOpen((v) => !v)}
            aria-label={navOpen ? '채널 목록 닫기' : '채널 목록 열기'}
            aria-expanded={navOpen}
          >
            <MenuIcon size={18} />
          </NavToggle>
          {userData && <SearchModal workspace={workspace} myId={userData.id} />}
          {userData && workspace && <TasksButton workspace={workspace} me={userData} />}
          {userData && workspace && <ThreadsButton workspace={workspace} myId={userData.id} />}
          {userData && workspace && <SavedButton workspace={workspace} myId={userData.id} />}
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
                        {userData.away ? (
                          <small className="away">○ 자리 비움</small>
                        ) : (
                          <small className="online">● 온라인</small>
                        )}
                        {(userData.statusEmoji || userData.statusText) && (
                          <small className="status" title={userData.statusText || undefined}>
                            {userData.statusEmoji} {userData.statusText}
                          </small>
                        )}
                      </div>
                    </header>
                    <ul role="menu">
                      <li>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowUserMenu(false);
                            setShowStatusModal(true);
                          }}
                        >
                          {userData.statusEmoji || userData.statusText ? '상태 바꾸기' : '상태 설정'}
                        </button>
                      </li>
                      <li>
                        <button type="button" role="menuitem" onClick={onToggleAway}>
                          {userData.away ? '온라인으로 표시' : '자리 비움으로 표시'}
                        </button>
                      </li>
                      <li>
                        <button type="button" role="menuitem" onClick={onToggleNotifications}>
                          {notificationMenuLabel}
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowUserMenu(false);
                            setShowDnd(true);
                          }}
                        >
                          🌙 방해 금지 시간
                          {isQuietNow(dnd) ? ' (지금 켜짐)' : dnd?.on ? ` (${dnd.start}~${dnd.end})` : ''}
                        </button>
                      </li>
                      <li className="divider" role="separator" />
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
                      <li>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowUserMenu(false);
                            setShowShortcuts(true);
                          }}
                        >
                          키보드 단축키
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowUserMenu(false);
                            setShowScheduled(true);
                          }}
                        >
                          예약 메시지 · 리마인더
                        </button>
                      </li>
                      <li>
                        <button type="button" role="menuitem" onClick={onCycleTheme} title="누를 때마다 바뀝니다">
                          <SunMoon size={15} /> 화면 테마: {THEME_LABELS[theme]}
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
          <Workspaces className={navOpen ? 'open' : undefined}>
            <AppNav aria-label="화면 메뉴">
              <Link
                to={messengerPath}
                className={section === 'messenger' ? 'active' : undefined}
                aria-current={section === 'messenger' ? 'page' : undefined}
              >
                <MessageSquare className="icon" size={20} />
                메신저
              </Link>
              <Link
                to={`/workspace/${workspace}/docs`}
                className={section === 'docs' ? 'active' : undefined}
                aria-current={section === 'docs' ? 'page' : undefined}
              >
                <FileText className="icon" size={20} />
                Docs
              </Link>
              <Link
                to={`/workspace/${workspace}/design`}
                className={section === 'design' ? 'active' : undefined}
                aria-current={section === 'design' ? 'page' : undefined}
              >
                <PenTool className="icon" size={20} />
                디자인
              </Link>
              <Link
                to={`/workspace/${workspace}/calendar`}
                className={section === 'calendar' ? 'active' : undefined}
                aria-current={section === 'calendar' ? 'page' : undefined}
              >
                <CalendarDays className="icon" size={20} />
                캘린더
              </Link>
              <Link
                to={`/workspace/${workspace}/contacts`}
                className={section === 'contacts' ? 'active' : undefined}
                aria-current={section === 'contacts' ? 'page' : undefined}
              >
                <BookUser className="icon" size={20} />
                연락처
              </Link>
            </AppNav>
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
          {navOpen && <NavBackdrop onClick={() => setNavOpen(false)} />}
          {section === 'messenger' && (
            <Channels className={navOpen ? 'open' : undefined}>
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
                      {currentWorkspace && userData && currentWorkspace.OwnerId === userData.id && (
                        <li>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setShowWorkspaceModal(false);
                              setShowWorkspaceSettings(true);
                            }}
                          >
                            워크스페이스 설정
                          </button>
                        </li>
                      )}
                      <li>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowWorkspaceModal(false);
                            setShowGroups(true);
                          }}
                        >
                          사용자 그룹
                        </button>
                      </li>
                      {isAdminRole(myRole) && (
                        <li>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setShowWorkspaceModal(false);
                              setShowApps(true);
                            }}
                          >
                            앱 연동
                          </button>
                        </li>
                      )}
                      <li>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowWorkspaceModal(false);
                            setShowEmojis(true);
                          }}
                        >
                          커스텀 이모지
                        </button>
                      </li>
                      {myRole !== 'guest' && (
                        <>
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
                        </>
                      )}
                      <li className="divider" role="separator" />
                      <li>
                        <button type="button" role="menuitem" className="danger" onClick={onLogOut}>
                          {userData?.nickname ? `${userData.nickname} 로그아웃` : '로그아웃'}
                        </button>
                      </li>
                    </ul>
                  </WorkspaceModal>
                </Menu>
                <PinnedList />
                <SidebarSections />
                <ChannelList />
                <DMList />
              </MenuScroll>
            </Channels>
          )}
          <Chats>
            <Switch>
              <Route path="/workspace/:workspace/channel/:channel" component={Channel} />
              <Route path="/workspace/:workspace/dm/:id" component={DirectMessage} />
              <Route path="/workspace/:workspace/docs" component={Docs} />
              <Route path="/workspace/:workspace/design" component={Design} />
              <Route path="/workspace/:workspace/calendar" component={Calendar} />
              <Route path="/workspace/:workspace/contacts/:view?" component={Contacts} />
            </Switch>
          </Chats>
        </WorkspaceWrapper>
        <CreateWorkspaceModal show={showCreateWorkspaceModal} onCloseModal={onCloseModal} />
        <StorageModal show={showStorageModal} onCloseModal={() => setShowStorageModal(false)} />
        {userData && workspace && (
          <QuickSwitcher
            show={showQuickSwitcher}
            workspace={workspace}
            myId={userData.id}
            onCloseModal={() => setShowQuickSwitcher(false)}
          />
        )}
        <ShortcutsModal show={showShortcuts} onCloseModal={() => setShowShortcuts(false)} />
        {workspace && userData && (
          <CustomEmojiModal
            show={showEmojis}
            workspace={workspace}
            me={userData}
            isOwner={isAdminRole(myRole)}
            canCreate={myRole !== 'guest'}
            onCloseModal={() => setShowEmojis(false)}
          />
        )}
        {workspace && userData && (
          <GroupsModal
            show={showGroups}
            workspace={workspace}
            me={userData}
            isOwner={isAdminRole(myRole)}
            canCreate={myRole !== 'guest'}
            onCloseModal={() => setShowGroups(false)}
          />
        )}
        {workspace && (
          <ScheduledModal show={showScheduled} workspace={workspace} onCloseModal={() => setShowScheduled(false)} />
        )}
        {currentWorkspace && userData && currentWorkspace.OwnerId === userData.id && (
          <WorkspaceSettingsModal
            show={showWorkspaceSettings}
            workspace={currentWorkspace}
            myId={userData.id}
            onCloseModal={() => setShowWorkspaceSettings(false)}
            onUrlChanged={moveToWorkspaceUrl}
          />
        )}
        <DndModal
          show={showDnd}
          current={dnd}
          onCloseModal={() => setShowDnd(false)}
          onSaved={(schedule) => {
            setMyDnd(schedule);
            setDnd(schedule);
          }}
        />
        {userData && (
          <StatusModal
            show={showStatusModal}
            me={userData}
            onCloseModal={() => setShowStatusModal(false)}
            onUpdated={() => revalidateUser()}
          />
        )}
        {userData && (
          <ProfileModal
            show={showProfileModal}
            me={userData}
            onCloseModal={() => setShowProfileModal(false)}
            onUpdated={() => revalidateUser()}
          />
        )}
        {showApps && workspace && (
          <AppsModal show={showApps} workspace={workspace} onCloseModal={() => setShowApps(false)} />
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
      </HuddleProvider>
    </CallProvider>
  );
};

export default Workspace;
