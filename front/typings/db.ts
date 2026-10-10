export interface IUser {
  id: number;
  nickname: string;
  email: string;
  Workspaces: IWorkspace[];
}

export interface IUserWithOnline extends IUser {
  online: boolean;
}

export interface IChannel {
  id: number;
  name: string;
  private: boolean; // 비공개 채널 여부 (초대받은 사람만 참여)
  WorkspaceId: number;
}

export interface IReaction {
  id: number;
  emoji: string;
  ChatId: number;
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
