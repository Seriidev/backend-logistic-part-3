import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { TrackingService } from './tracking.service';
import { UpdateGpsDto } from './dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { Permissions } from '../../core/decorators/permissions.decorator';
import { Public } from '../../core/decorators/public.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Permission } from '../../shared/enums/permissions.enum';

@ApiTags('Tracking')
@Controller('tracking')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC — no auth required
  // ─────────────────────────────────────────────────────────────────────────

  @Get(':trackingNumber')
  @Public()
  @ApiOperation({ summary: 'Public shipment tracking by tracking number' })
  @ApiParam({ name: 'trackingNumber', example: 'YU-ABC12345' })
  @ApiResponse({ status: 200, description: 'Tracking info returned' })
  @ApiResponse({ status: 404, description: 'Shipment not found' })
  async getPublicTracking(@Param('trackingNumber') trackingNumber: string) {
    return this.trackingService.getPublicTracking(trackingNumber);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AUTHENTICATED endpoints
  // ─────────────────────────────────────────────────────────────────────────

  @Get(':id/timeline')
  @ApiBearerAuth()
  @Permissions(Permission.TRACKING_VIEW)
  @ApiOperation({ summary: 'Get full event timeline for a shipment' })
  @ApiParam({ name: 'id', description: 'Shipment UUID' })
  async getTimeline(@Param('id', ParseUUIDPipe) id: string) {
    return this.trackingService.getTimeline(id);
  }

  @Post(':id/gps')
  @ApiBearerAuth()
  @Permissions(Permission.TRACKING_UPDATE_GPS)
  @ApiOperation({ summary: 'Update GPS coordinates from driver' })
  @ApiParam({ name: 'id', description: 'Shipment UUID' })
  async updateGps(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGpsDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.trackingService.updateGps(id, dto, userId);
  }

  @Get(':id/gps-history')
  @ApiBearerAuth()
  @Permissions(Permission.TRACKING_VIEW)
  @ApiOperation({ summary: 'Get GPS coordinate history for a shipment' })
  @ApiParam({ name: 'id', description: 'Shipment UUID' })
  async getGpsHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.trackingService.getGpsHistory(id);
  }

  @Get(':id/eta')
  @ApiBearerAuth()
  @Permissions(Permission.TRACKING_VIEW)
  @ApiOperation({ summary: 'Get estimated delivery time (ETA)' })
  @ApiParam({ name: 'id', description: 'Shipment UUID' })
  async getEta(@Param('id', ParseUUIDPipe) id: string) {
    return this.trackingService.getEta(id);
  }
}
