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
import { ChannelMembers } from '../entities/ChannelMembers';
import { WorkspaceMembers } from '../entities/WorkspaceMembers';
import { onlineMap } from './onlineMap';

// SessionIoAdapter 가 핸드셰이크 때 세션에서 꺼내 둔 로그인 사용자
const getSessionUser = (
  socket: Socket,
): { id: number; nickname: string } | undefined => (socket.request as any).user;

@WebSocketGateway({
  namespace: /\/ws-.+/,
  cors: { origin: true, credentials: true },
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

  // 워크스페이스에서 내보낸 사용자의 연결을 끊어 더 이상 메시지를 받지 못하게 한다
  removeUserFromWorkspace(url: string, userId: number) {
    for (const socket of this.socketsOf(`/ws-${url}`, userId)) {
      socket.emit('removedFromWorkspace', { url });
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
