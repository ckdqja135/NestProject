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

  private getOnlineList(namespace: string) {
    return [...new Set(Object.values(onlineMap[namespace] || {}))];
  }
}
