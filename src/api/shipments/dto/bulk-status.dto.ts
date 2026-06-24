import {
  IsArray,
  IsUUID,
  ValidateNested,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ShipmentStatusEnum } from './update-status.dto';

export class BulkStatusItemDto {
  @ApiProperty({ description: 'Shipment ID' })
  @IsUUID()
  shipmentId!: string;

  @ApiProperty({ enum: ShipmentStatusEnum, description: 'New status' })
  @IsEnum(ShipmentStatusEnum)
  status!: ShipmentStatusEnum;

  @ApiPropertyOptional({ description: 'Note for this status change' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class BulkStatusDto {
  @ApiProperty({
    type: [BulkStatusItemDto],
    description: 'List of shipment status updates',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkStatusItemDto)
  items!: BulkStatusItemDto[];
}
