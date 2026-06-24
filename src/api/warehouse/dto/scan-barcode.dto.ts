import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ScanBarcodeDto {
  @ApiProperty({ description: 'Barcode or QR code value to scan' })
  @IsString()
  @MaxLength(200)
  barcode!: string;
}
