import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiResponseDto<T = unknown> {
  @ApiProperty()
  success!: boolean;

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional()
  data?: T;

  @ApiProperty()
  timestamp!: string;

  static success<T>(data: T, message?: string): ApiResponseDto<T> {
    const response = new ApiResponseDto<T>();
    response.success = true;
    response.data = data;
    response.message = message;
    response.timestamp = new Date().toISOString();
    return response;
  }

  static error(message: string, errors?: string[]): ApiResponseDto {
    const response = new ApiResponseDto();
    response.success = false;
    response.message = message;
    response.data = errors;
    response.timestamp = new Date().toISOString();
    return response;
  }
}
