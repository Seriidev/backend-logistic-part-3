import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { Permissions } from '../../core/decorators/permissions.decorator';
import { Permission } from '../../shared/enums/permissions.enum';

@ApiTags('Users / Drivers')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ── Drivers ──────────────────────────────────────────────────────────────

  @Get('drivers')
  @Permissions(Permission.AUTH_VIEW_USERS)
  @ApiOperation({ summary: 'List all active drivers' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listDrivers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.listDrivers(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get('drivers/:id')
  @Permissions(Permission.AUTH_VIEW_USERS)
  @ApiOperation({ summary: 'Get driver profile with assigned shipments' })
  @ApiParam({ name: 'id', description: 'Driver UUID' })
  async getDriver(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getDriver(id);
  }

  @Post('drivers/:driverId/assign/:shipmentId')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.SHIPMENTS_ASSIGN_DRIVER)
  @ApiOperation({ summary: 'Assign a driver to a shipment' })
  @ApiParam({ name: 'driverId', description: 'Driver UUID' })
  @ApiParam({ name: 'shipmentId', description: 'Shipment UUID' })
  @ApiResponse({ status: 200, description: 'Driver assigned successfully' })
  async assignDriver(
    @Param('driverId', ParseUUIDPipe) driverId: string,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
  ) {
    return this.usersService.assignDriver(shipmentId, driverId);
  }

  @Delete('drivers/:driverId/assign/:shipmentId')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.SHIPMENTS_ASSIGN_DRIVER)
  @ApiOperation({ summary: 'Unassign driver from a shipment' })
  @ApiParam({ name: 'driverId', description: 'Driver UUID' })
  @ApiParam({ name: 'shipmentId', description: 'Shipment UUID' })
  async unassignDriver(@Param('shipmentId', ParseUUIDPipe) shipmentId: string) {
    return this.usersService.unassignDriver(shipmentId);
  }
}
