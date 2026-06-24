import { Module } from '@nestjs/common';
import { StorageModule } from './storage/storage.module';
import { MailModule } from './mail/mail.module';
import { SmsModule } from './sms/sms.module';
import { MapsModule } from './maps/maps.module';
import { PaymentsModule } from './payments/payments.module';
import { OcrModule } from './ocr/ocr.module';

@Module({
  imports: [
    StorageModule,
    MailModule,
    SmsModule,
    MapsModule,
    PaymentsModule,
    OcrModule,
  ],
  exports: [
    StorageModule,
    MailModule,
    SmsModule,
    MapsModule,
    PaymentsModule,
    OcrModule,
  ],
})
export class IntegrationsModule {}
