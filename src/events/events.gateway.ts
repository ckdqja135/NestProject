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
import { Namespace, Server, Socket } from 'socket.io';
import { onlineMap } from './onlineMap';

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

  afterInit(server: Server | Namespace) {
    this.logger.log('websocket gateway initialized');
  }

  handleConnection(@ConnectedSocket() socket: Socket) {
    const namespace = socket.nsp.name;
    this.logger.log(`connected ${namespace} ${socket.id}`);
    if (!onlineMap[namespace]) {
      onlineMap[namespace] = {};
    }
    socket.emit('hello', namespace);
  }

  handleDisconnect(@ConnectedSocket() socket: Socket) {
    const namespace = socket.nsp.name;
    this.logger.log(`disconnected ${namespace} ${socket.id}`);
    if (onlineMap[namespace]) {
      delete onlineMap[namespace][socket.id];
      socket.nsp.emit('onlineList', this.getOnlineList(namespace));
    }
  }

  @SubscribeMessage('login')
  handleLogin(
    @MessageBody() data: { id: number; channels: number[] },
    @ConnectedSocket() socket: Socket,
  ) {
    const namespace = socket.nsp.name;
    if (!onlineMap[namespace]) {
      onlineMap[namespace] = {};
    }
    onlineMap[namespace][socket.id] = data.id;
    (data.channels || []).forEach((channelId) => {
      socket.join(`${namespace}-${channelId}`);
    });
    socket.nsp.emit('onlineList', this.getOnlineList(namespace));
  }

  // 입력 중 표시: 채널이면 채널 룸에, DM 이면 상대방 소켓에 전달 (보낸 사람 제외)
  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody()
    data: { channelId?: number; receiverId?: number; nickname: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const namespace = socket.nsp.name;
    const userId = onlineMap[namespace]?.[socket.id];
    if (!userId || !data) {
      return;
    }
    const payload = {
      userId,
      nickname: String(data.nickname || '').slice(0, 30),
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
      const targets = Object.keys(onlineMap[namespace] || {}).filter(
        (id) => onlineMap[namespace][id] === data.receiverId,
      );
      if (targets.length) {
        socket.nsp.to(targets).emit('typing', payload);
      }
    }
  }

  private getOnlineList(namespace: string) {
    return [...new Set(Object.values(onlineMap[namespace] || {}))];
  }
}
