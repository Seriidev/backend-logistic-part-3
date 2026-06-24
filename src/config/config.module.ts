import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './app.config';
import databaseConfig from './database.config';
import redisConfig from './redis.config';
import jwtConfig from './jwt.config';
import storageConfig from './storage.config';
import mailConfig from './mail.config';
import smsConfig from './sms.config';
import mapsConfig from './maps.config';
import stripeConfig from './stripe.config';
import throttleConfig from './throttle.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        jwtConfig,
        storageConfig,
        mailConfig,
        smsConfig,
        mapsConfig,
        stripeConfig,
        throttleConfig,
      ],
    }),
  ],
})
export class AppConfigModule {}
