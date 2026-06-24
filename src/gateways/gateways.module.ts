import { Module } from '@nestjs/common';
import { TrackingGateway } from './tracking.gateway';
import { NotificationsGateway } from './notifications.gateway';

@Module({
  providers: [TrackingGateway, NotificationsGateway],
  exports: [TrackingGateway, NotificationsGateway],
})
export class GatewaysModule {}
