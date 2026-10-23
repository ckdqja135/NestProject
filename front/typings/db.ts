export interface IUser {
  id: number;
  nickname: string;
  email: string;
  avatarStyle?: string | null; // Gravatar 기본 이미지 종류
  statusEmoji?: string | null; // 상태 메시지 (예: 🗓️ 회의 중)
  statusText?: string | null;
  department?: string | null; // 연락처: 부서
  jobTitle?: string | null; // 연락처: 직책
  phone?: string | null; // 연락처: 전화번호
  away?: boolean; // 자리 비움으로 표시
  theme?: 'system' | 'light' | 'dark' | null; // 계정에 저장한 화면 테마 (모든 기기 공통)
  notificationsPaused?: boolean; // 데스크톱 알림 일시 중지 (모든 기기 공통)
  bot?: boolean; // 봇 계정 (캘린더 어시스턴트)
  Workspaces: IWorkspace[];
}

export interface IUserWithOnline extends IUser {
  online: boolean;
}

export interface IChannel {
  id: number;
  name: string;
  private: boolean; // 비공개 채널 여부 (초대받은 사람만 참여)
  muted?: boolean; // 내가 이 채널 알림을 껐는지
  topic?: string | null; // 채널 주제
  archived?: boolean; // 보관된 채널 (읽기 전용)
  OwnerId?: number | null; // 채널을 만든 사람
  WorkspaceId: number;
}

export interface IReaction {
  id: number;
  emoji: string;
  ChatId?: number; // 채널 메시지 리액션
  DMId?: number; // DM 리액션
  UserId: number;
}

export interface IChat {
  // 채널의 채팅
  id: number;
  UserId: number;
  User: IUser | null; // 보낸 사람 (수신 웹훅 메시지면 없음)
  botName?: string | null; // 수신 웹훅 메시지의 보낸 사람 이름
  content: string;
  createdAt: Date;
  editedAt?: Date | null; // 내용을 수정한 시각
  ChannelId: number;
  Channel: IChannel;
  ParentId?: number | null; // 스레드 답글이면 원본 메시지 id
  pinned?: boolean;
  replyCount?: number;
  Reactions?: IReaction[];
}

export interface IDM {
  // DM 채팅
  id: number;
  SenderId: number; // 보낸 사람 아이디
  Sender: IUser;
  ReceiverId: number; // 받는 사람 아이디
  Receiver: IUser;
  content: string;
  createdAt: Date;
  editedAt?: Date | null;
  pinned?: boolean;
  Reactions?: IReaction[];
}

export interface IWorkspace {
  id: number;
  name: string;
  url: string; // 주소 창에 보이는 주소
  OwnerId: number; // 워크스페이스 만든 사람 아이디
}

export interface ISearchResult {
  chats: IChat[];
  dms: IDM[];
  hasMoreChats?: boolean; // 다음 페이지가 있는지
  hasMoreDms?: boolean;
}

export interface ITyping {
  userId: number;
  nickname: string;
  channelId: number | null;
  dm: boolean;
}

export interface IMention {
  id: number;
  ChatId: number;
  SenderId: number;
  ReceiverId: number;
  readAt: string | null;
  createdAt: string;
  Chat: IChat;
}

export interface IMentionList {
  items: IMention[];
  unreadByChannel: { [channelId: number]: number };
  unreadTotal: number;
}

// 나중에 보려고 저장한 메시지 (채널 메시지 또는 DM)
export interface ISavedItem {
  id: number;
  ChatId: number | null;
  DMId: number | null;
  createdAt: Date;
  Chat: (IChat & { Channel: IChannel }) | null;
  DM: IDM | null;
}

// 내가 참여한 스레드 (원본 메시지 + 마지막 답글)
export interface IThread extends IChat {
  lastReply: IChat;
}

// 예약 메시지 (채널 또는 DM)
export interface IScheduledMessage {
  id: number;
  content: string;
  sendAt: string;
  ChannelId: number | null;
  ReceiverId: number | null;
  Channel: IChannel | null;
  Receiver: IUser | null;
}

// 리마인더 (채널 메시지 또는 DM)
export interface IReminder {
  id: number;
  remindAt: string;
  ChatId: number | null;
  DMId: number | null;
  Chat: (IChat & { Channel: IChannel }) | null;
  DM: IDM | null;
}

// 사용자 그룹 (@디자인팀 처럼 멘션)
export interface IUserGroup {
  id: number;
  name: string;
  description: string | null;
  CreatorId: number | null;
  Members: { UserId: number; User: Pick<IUser, 'id' | 'nickname' | 'email' | 'avatarStyle'> }[];
}

// 워크스페이스 커스텀 이모지 (:name:)
export interface ICustomEmoji {
  id: number;
  name: string;
  image: string; // data URL
  CreatorId: number | null;
}

// Docs: 목록 한 줄 (내용 없이)
export interface IDocListItem {
  id: number;
  title: string;
  type: 'doc' | 'wiki' | 'slides' | 'sheet' | 'board';
  visibility: 'private' | 'workspace';
  folderId: number | null;
  parentId: number | null;
  ownerId: number | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerAvatarStyle: string | null;
  folderName: string | null;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  viewedAt: string | null;
  deletedAt: string | null;
}

// Docs: 문서 하나 (내용·권한 포함)
export interface IDoc {
  id: number;
  title: string;
  type: 'doc' | 'wiki' | 'slides' | 'sheet' | 'board';
  content: string;
  visibility: 'private' | 'workspace';
  FolderId: number | null;
  ParentId: number | null;
  OwnerId: number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  Owner: IUser | null;
  LastEditor: IUser | null;
  Folder: IDocFolder | null;
  Shares: { UserId: number; role: 'view' | 'edit'; User: IUser }[];
  canEdit: boolean;
  canManage: boolean;
  favorite: boolean;
}

export interface IDocFolder {
  id: number;
  name: string;
  ParentId: number | null;
}

export interface IWikiPage {
  id: number;
  title: string;
  ParentId: number | null;
  updatedAt: string;
}

// 캘린더
export type RsvpStatus = 'pending' | 'accepted' | 'declined';

export interface ICalendarAttendee {
  UserId: number;
  status: RsvpStatus;
  User: IUser;
}

export interface ICalendarEvent {
  id: number;
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: string | null;
  visibility: 'public' | 'private';
  reminderMinutes?: number | null;
  OwnerId: number | null;
  Owner?: IUser | null;
  Attendees: ICalendarAttendee[];
  masked: boolean; // 비공개 일정을 참석자 아닌 사람이 볼 때 ('바쁨')
  calendars: number[]; // 이 일정이 속한 캘린더(사용자 id)
  myStatus: 'owner' | RsvpStatus | null;
}

// 외부 연락처 (워크스페이스 밖 사람, 내가 저장한 것만 보인다)
export interface IContact {
  id: number;
  name: string;
  company: string | null;
  department: string | null;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  memo: string | null;
  starred: boolean;
  createdAt: string;
  updatedAt: string;
}
