import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateLocationDto {
  @ApiProperty({
    description: 'New storage cell / location',
    example: 'B-02-05',
  })
  @IsString()
  @MaxLength(100)
  location!: string;
}
