import { Module } from '@nestjs/common';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsService } from './shipments.service';
import { LabelService } from './services/label.service';
import { StorageModule } from '../../integrations/storage/storage.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule, StorageModule],
  controllers: [ShipmentsController],
  providers: [ShipmentsService, LabelService],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}
