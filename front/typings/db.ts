export interface IUser {
  id: number;
  nickname: string;
  email: string;
  avatarStyle?: string | null; // Gravatar 기본 이미지 종류
  statusEmoji?: string | null; // 상태 메시지 (예: 🗓️ 회의 중)
  statusText?: string | null;
  away?: boolean; // 자리 비움으로 표시
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
  User: IUser; // 보낸 사람
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
