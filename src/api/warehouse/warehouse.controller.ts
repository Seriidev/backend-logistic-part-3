import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
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
import { WarehouseService } from './warehouse.service';
import {
  ReceiveShipmentDto,
  ScanBarcodeDto,
  UpdateLocationDto,
  OutboundShipmentDto,
} from './dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { Permissions } from '../../core/decorators/permissions.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Permission } from '../../shared/enums/permissions.enum';

@ApiTags('Warehouse')
@ApiBearerAuth()
@Controller('warehouse')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Post('receive')
  @Permissions(Permission.WAREHOUSE_RECEIVE)
  @ApiOperation({ summary: 'Receive a shipment into the warehouse' })
  @ApiResponse({ status: 201, description: 'Shipment received' })
  async receive(
    @Body() dto: ReceiveShipmentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.warehouseService.receive(dto, userId);
  }

  @Post('scan')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.WAREHOUSE_SCAN)
  @ApiOperation({ summary: 'Scan barcode to look up shipment' })
  @ApiResponse({ status: 200, description: 'Warehouse item found' })
  async scan(@Body() dto: ScanBarcodeDto) {
    return this.warehouseService.scan(dto);
  }

  @Get('inventory')
  @Permissions(Permission.WAREHOUSE_INVENTORY)
  @ApiOperation({ summary: 'Get current warehouse inventory' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getInventory(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.warehouseService.getInventory(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Patch(':id/location')
  @Permissions(Permission.WAREHOUSE_SCAN)
  @ApiOperation({
    summary: 'Update storage cell / location for a warehouse item',
  })
  @ApiParam({ name: 'id', description: 'Warehouse item UUID' })
  async updateLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLocationDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.warehouseService.updateLocation(id, dto, userId);
  }

  @Post('outbound')
  @Permissions(Permission.WAREHOUSE_OUTBOUND)
  @ApiOperation({ summary: 'Mark shipment as outbound (ready for pickup)' })
  @ApiResponse({ status: 201, description: 'Shipment marked as outbound' })
  async outbound(
    @Body() dto: OutboundShipmentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.warehouseService.outbound(dto, userId);
  }

  @Get('reports')
  @Permissions(Permission.WAREHOUSE_REPORTS)
  @ApiOperation({ summary: 'Get warehouse summary reports' })
  async getReports() {
    return this.warehouseService.getReports();
  }
}
