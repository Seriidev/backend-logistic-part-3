import { IsUUID, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReceiveShipmentDto {
  @ApiProperty({ description: 'Shipment UUID to receive into warehouse' })
  @IsUUID()
  shipmentId!: string;

  @ApiPropertyOptional({
    description: 'Storage cell / location',
    example: 'A-01-03',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({ description: 'Barcode or QR code value' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  barcode?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
