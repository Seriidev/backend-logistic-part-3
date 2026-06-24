import { IsUUID, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OutboundShipmentDto {
  @ApiProperty({ description: 'Shipment UUID to mark as outbound' })
  @IsUUID()
  shipmentId!: string;

  @ApiPropertyOptional({ description: 'Notes for outbound operation' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
