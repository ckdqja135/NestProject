import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Namespace, Server, Socket } from 'socket.io';
import { ChannelChats } from '../entities/ChannelChats';
import { ChannelMembers } from '../entities/ChannelMembers';
import { DMs } from '../entities/DMs';
import { findFileMessage } from '../files/find-file-message';
import { WorkspaceMembers } from '../entities/WorkspaceMembers';
import { onlineMap } from './onlineMap';
import { corsOrigin, isAllowedOrigin } from '../security';

// SessionIoAdapter 가 핸드셰이크 때 세션에서 꺼내 둔 로그인 사용자
const getSessionUser = (
  socket: Socket,
): { id: number; nickname: string } | undefined => (socket.request as any).user;

@WebSocketGateway({
  namespace: /\/ws-.+/,
  cors: { origin: corsOrigin, credentials: true },
  // 웹소켓 연결에는 CORS 가 적용되지 않으므로 핸드셰이크에서 출처를 직접 확인한다 (다른 사이트에서의 소켓 가로채기 방지)
  allowRequest: (req, callback) =>
    callback(null, isAllowedOrigin(req.headers.origin, req.headers.host)),
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  // 동적 네임스페이스를 사용하므로 server는 개별 Namespace 이다.
  @WebSocketServer() public server: Namespace;
  private logger = new Logger('EventsGateway');

  constructor(
    @InjectRepository(WorkspaceMembers)
    private workspaceMembersRepository: Repository<WorkspaceMembers>,
    @InjectRepository(ChannelMembers)
    private channelMembersRepository: Repository<ChannelMembers>,
    @InjectRepository(ChannelChats)
    private channelChatsRepository: Repository<ChannelChats>,
    @InjectRepository(DMs)
    private dmsRepository: Repository<DMs>,
  ) {}

  afterInit(server: Server | Namespace) {
    this.logger.log('websocket gateway initialized');
  }

  async handleConnection(@ConnectedSocket() socket: Socket) {
    const namespace = socket.nsp.name;
    const joined = await this.syncRooms(socket);
    if (!joined) {
      // 로그인하지 않았거나 워크스페이스 멤버가 아니면 연결을 끊는다
      socket.disconnect(true);
      return;
    }
    this.logger.log(`connected ${namespace} ${socket.id}`);
    socket.emit('hello', namespace);
    socket.nsp.emit('onlineList', this.getOnlineList(namespace));
  }

  handleDisconnect(@ConnectedSocket() socket: Socket) {
    const namespace = socket.nsp.name;
    this.logger.log(`disconnected ${namespace} ${socket.id}`);
    if (onlineMap[namespace]?.[socket.id]) {
      delete onlineMap[namespace][socket.id];
      socket.nsp.emit('onlineList', this.getOnlineList(namespace));
    }
  }

  // 클라이언트가 채널 목록을 불러왔을 때(채널 생성/참여/나가기 후 포함) 보내는 이벤트.
  // 클라이언트가 보낸 id/채널 목록은 믿지 않고 세션과 DB 로 다시 계산한다.
  @SubscribeMessage('login')
  async handleLogin(@ConnectedSocket() socket: Socket) {
    if (await this.syncRooms(socket)) {
      socket.nsp.emit('onlineList', this.getOnlineList(socket.nsp.name));
    }
  }

  // 입력 중 표시: 채널이면 채널 룸에, DM 이면 상대방 소켓에 전달 (보낸 사람 제외)
  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { channelId?: number; receiverId?: number },
    @ConnectedSocket() socket: Socket,
  ) {
    const namespace = socket.nsp.name;
    const user = getSessionUser(socket);
    if (!user || !onlineMap[namespace]?.[socket.id] || !data) {
      return;
    }
    const payload = {
      userId: user.id,
      nickname: user.nickname,
      channelId: data.channelId ?? null,
      dm: !data.channelId,
    };
    if (data.channelId) {
      const room = `${namespace}-${data.channelId}`;
      // 참여 중인 채널에만 보낼 수 있다
      if (socket.rooms.has(room)) {
        socket.to(room).emit('typing', payload);
      }
    } else if (data.receiverId) {
      const targets = Object.keys(onlineMap[namespace]).filter(
        (id) => onlineMap[namespace][id] === data.receiverId,
      );
      if (targets.length) {
        socket.nsp.to(targets).emit('typing', payload);
      }
    }
  }

  // 받지 못한 파일 다시 받기: 접속 중인 보낸 사람의 탭에 파일을 다시 보내 달라고 요청한다.
  // 파일 내용은 보낸 사람 브라우저 → 서버(중계만) → 요청한 사람 으로 전달되고 서버에는 남지 않는다.
  @SubscribeMessage('fileRequest')
  async handleFileRequest(
    @MessageBody() data: { fileId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const user = getSessionUser(socket);
    const url = socket.nsp.name.replace(/^\/ws-/, '');
    if (!user || !data?.fileId) {
      return;
    }
    const unavailable = (reason: 'not-found' | 'offline') =>
      socket.emit('fileUnavailable', { fileId: data.fileId, reason });
    const message = await findFileMessage(
      {
        channelChats: this.channelChatsRepository,
        dms: this.dmsRepository,
        channelMembers: this.channelMembersRepository,
      },
      url,
      data.fileId,
    );
    if (!message || !(await message.canAccess(user.id))) {
      return unavailable('not-found');
    }
    // 보낸 사람의 다른 탭 중 하나에만 요청 (같은 브라우저 탭들은 저장소를 공유하므로 중복 전송 방지)
    const senderSocket = this.socketsOf(socket.nsp.name, message.senderId).find(
      (s) => s.id !== socket.id,
    );
    if (!senderSocket) {
      return unavailable('offline');
    }
    senderSocket.emit('fileRequested', {
      fileId: data.fileId,
      requesterId: user.id,
    });
  }

  // 보낸 사람 기기에도 파일이 없을 때 요청한 사람에게 알린다
  @SubscribeMessage('fileMissing')
  handleFileMissing(
    @MessageBody() data: { fileId: string; requesterId: number },
    @ConnectedSocket() socket: Socket,
  ) {
    if (!getSessionUser(socket) || !data?.fileId) {
      return;
    }
    this.emitToUser(
      socket.nsp.name.replace(/^\/ws-/, ''),
      Number(data.requesterId),
      'fileUnavailable',
      { fileId: data.fileId, reason: 'missing' },
    );
  }

  // 특정 사용자가 이 네임스페이스에 연결한 소켓들
  private socketsOf(namespace: string, userId: number): Socket[] {
    // 동적 네임스페이스는 접속이 생길 때 만들어지므로 이미 있는 것만 조회한다 (of() 는 새로 만들어버림)
    const nsp: Namespace | undefined = (this.server as any).server?._nsps?.get(
      namespace,
    );
    if (!nsp) {
      return [];
    }
    return Object.keys(onlineMap[namespace] || {})
      .filter((socketId) => onlineMap[namespace][socketId] === userId)
      .map((socketId) => nsp.sockets.get(socketId))
      .filter((socket): socket is Socket => !!socket);
  }

  // 채널 초대 등으로 참여 채널이 바뀐 사용자의 소켓을 바로 새 채널 방에 넣고, 화면에 목록 갱신을 알린다
  async refreshUserChannels(url: string, userId: number) {
    for (const socket of this.socketsOf(`/ws-${url}`, userId)) {
      await this.syncRooms(socket);
      socket.emit('channelsChanged');
    }
  }

  // 워크스페이스 목록이 바뀐 사용자에게 (접속 중인 모든 워크스페이스 화면에) 알린다
  notifyWorkspacesChanged(userId: number) {
    Object.keys(onlineMap).forEach((namespace) => {
      this.socketsOf(namespace, userId).forEach((socket) =>
        socket.emit('workspacesChanged'),
      );
    });
  }

  // 이 워크스페이스에 접속 중인지 (리마인더는 접속해 있을 때 알린다)
  isOnline(url: string, userId: number) {
    return this.socketsOf(`/ws-${url}`, userId).length > 0;
  }

  // 특정 사용자에게 (이 워크스페이스에 연결된 모든 탭으로) 이벤트 전송
  emitToUser(url: string, userId: number, event: string, data?: unknown) {
    this.socketsOf(`/ws-${url}`, userId).forEach((socket) =>
      socket.emit(event, data),
    );
  }

  // 워크스페이스에 접속한 모든 사람에게 이벤트 전송
  emitToWorkspace(url: string, event: string, data?: unknown) {
    const nsp: Namespace | undefined = (this.server as any).server?._nsps?.get(
      `/ws-${url}`,
    );
    nsp?.emit(event, data);
  }

  // 워크스페이스에서 내보낸(또는 스스로 나간) 사용자의 연결을 끊어 더 이상 메시지를 받지 못하게 한다
  removeUserFromWorkspace(
    url: string,
    userId: number,
    reason: 'kicked' | 'left' = 'kicked',
  ) {
    for (const socket of this.socketsOf(`/ws-${url}`, userId)) {
      socket.emit('removedFromWorkspace', { url, reason });
      // disconnect(true) 는 같은 연결을 공유하는 다른 워크스페이스 소켓까지 끊으므로 이 네임스페이스만 끊는다
      socket.disconnect();
    }
    this.notifyWorkspacesChanged(userId);
  }

  // 세션 사용자가 이 워크스페이스 멤버인지 확인하고, 참여 중인 채널 룸에만 들어가게 한다
  private async syncRooms(socket: Socket) {
    const namespace = socket.nsp.name;
    const url = namespace.replace(/^\/ws-/, '');
    const user = getSessionUser(socket);
    if (!user) {
      return false;
    }
    const isMember = await this.workspaceMembersRepository
      .createQueryBuilder('members')
      .innerJoin('members.Workspace', 'workspace', 'workspace.url = :url', {
        url,
      })
      .where('members.UserId = :userId', { userId: user.id })
      .getExists();
    if (!isMember || !socket.connected) {
      return false;
    }
    const channels = await this.channelMembersRepository
      .createQueryBuilder('members')
      .innerJoin('members.Channel', 'channel')
      .innerJoin('channel.Workspace', 'workspace', 'workspace.url = :url', {
        url,
      })
      .where('members.UserId = :userId', { userId: user.id })
      .select('members.ChannelId', 'channelId')
      .getRawMany<{ channelId: number }>();

    const rooms = new Set(channels.map((c) => `${namespace}-${c.channelId}`));
    socket.rooms.forEach((room) => {
      if (room.startsWith(`${namespace}-`) && !rooms.has(room)) {
        socket.leave(room);
      }
    });
    socket.join([...rooms]);

    if (!onlineMap[namespace]) {
      onlineMap[namespace] = {};
    }
    onlineMap[namespace][socket.id] = user.id;
    return true;
  }

  private getOnlineList(namespace: string) {
    return [...new Set(Object.values(onlineMap[namespace] || {}))];
  }
}
