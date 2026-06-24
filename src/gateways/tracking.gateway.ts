import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/tracking',
})
export class TrackingGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TrackingGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribeTracking')
  handleSubscribeTracking(
    @MessageBody() trackingNumber: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`tracking:${trackingNumber}`);
    this.logger.log(
      `Client ${client.id} subscribed to tracking: ${trackingNumber}`,
    );
  }

  // Emit tracking update to all subscribers
  emitTrackingUpdate(trackingNumber: string, data: unknown) {
    this.server.to(`tracking:${trackingNumber}`).emit('trackingUpdate', data);
  }
}
