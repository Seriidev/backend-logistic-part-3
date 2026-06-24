import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

// Config
import { AppConfigModule } from './config/config.module';

// Database
import { DatabaseModule } from './database/database.module';

// Core
import { CoreModule } from './core/core.module';
import { LoggerMiddleware } from './core/middleware/logger.middleware';
import { CorrelationIdMiddleware } from './core/middleware/correlation-id.middleware';

// Shared
import { SharedModule } from './shared/shared.module';

// API Modules
import { AuthModule } from './api/auth/auth.module';
import { UsersModule } from './api/users/users.module';
import { ShipmentsModule } from './api/shipments/shipments.module';
import { TrackingModule } from './api/tracking/tracking.module';
import { WarehouseModule } from './api/warehouse/warehouse.module';
import { WalletModule } from './api/wallet/wallet.module';
import { CrmModule } from './api/crm/crm.module';
import { NotificationsModule } from './api/notifications/notifications.module';

// Gateways
import { GatewaysModule } from './gateways/gateways.module';

// Integrations
import { IntegrationsModule } from './integrations/integrations.module';

// Jobs
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    // Configuration
    AppConfigModule,

    // Rate Limiting — Global: 100 req/min per IP
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.GLOBAL_THROTTLE_TTL || '60000', 10),
        limit: parseInt(process.env.GLOBAL_THROTTLE_LIMIT || '100', 10),
      },
    ]),

    // Database
    DatabaseModule,

    // Core
    CoreModule,

    // Shared
    SharedModule,

    // API Feature Modules
    AuthModule,
    UsersModule,
    ShipmentsModule,
    TrackingModule,
    WarehouseModule,
    WalletModule,
    CrmModule,
    NotificationsModule,

    // WebSocket Gateways
    GatewaysModule,

    // Third-party Integrations
    IntegrationsModule,

    // Background Jobs
    JobsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware, LoggerMiddleware).forRoutes('*');
  }
}
