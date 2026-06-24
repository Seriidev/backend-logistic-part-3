import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ShipmentsService } from './shipments.service';
import { LabelService } from './services/label.service';
import {
  CreateShipmentDto,
  UpdateShipmentDto,
  UpdateStatusDto,
  QueryShipmentsDto,
  BulkStatusDto,
} from './dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { Permissions } from '../../core/decorators/permissions.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Permission } from '../../shared/enums/permissions.enum';
import 'multer';

@ApiTags('Shipments')
@ApiBearerAuth()
@Controller('shipments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ShipmentsController {
  constructor(
    private readonly shipmentsService: ShipmentsService,
    private readonly labelService: LabelService,
  ) {}

  // ===========================
  // CREATE
  // ===========================
  @Post()
  @Permissions(Permission.SHIPMENTS_CREATE)
  @ApiOperation({ summary: 'Create a new shipment' })
  @ApiResponse({ status: 201, description: 'Shipment created' })
  async create(
    @Body() dto: CreateShipmentDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.shipmentsService.create(dto, userId);
  }

  // ===========================
  // LIST (with filters)
  // ===========================
  @Get()
  @Permissions(Permission.SHIPMENTS_VIEW_ALL)
  @ApiOperation({ summary: 'List shipments with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated shipment list' })
  async findAll(@Query() query: QueryShipmentsDto) {
    return this.shipmentsService.findAll(query);
  }

  // ===========================
  // STATS (for dashboard)
  // ===========================
  @Get('stats')
  @Permissions(Permission.SHIPMENTS_VIEW_ALL)
  @ApiOperation({ summary: 'Get shipment statistics for dashboard' })
  @ApiResponse({ status: 200, description: 'Shipment statistics' })
  async getStats() {
    return this.shipmentsService.getStats();
  }

  // ===========================
  // BULK STATUS UPDATE
  // ===========================
  @Post('bulk-status')
  @Permissions(Permission.SHIPMENTS_BULK_UPDATE)
  @ApiOperation({ summary: 'Bulk update shipment statuses' })
  @ApiResponse({ status: 200, description: 'Bulk update results' })
  @HttpCode(HttpStatus.OK)
  async bulkUpdateStatus(
    @Body() dto: BulkStatusDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.shipmentsService.bulkUpdateStatus(dto, userId);
  }

  // ===========================
  // GET ONE
  // ===========================
  @Get(':id')
  @Permissions(Permission.SHIPMENTS_VIEW_ALL)
  @ApiOperation({ summary: 'Get shipment details' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Shipment details' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.shipmentsService.findOne(id);
  }

  // ===========================
  // UPDATE
  // ===========================
  @Put(':id')
  @Permissions(Permission.SHIPMENTS_EDIT)
  @ApiOperation({ summary: 'Update shipment details' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Shipment updated' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShipmentDto,
  ) {
    return this.shipmentsService.update(id, dto);
  }

  // ===========================
  // UPDATE STATUS
  // ===========================
  @Patch(':id/status')
  @Permissions(Permission.SHIPMENTS_UPDATE_STATUS)
  @ApiOperation({ summary: 'Update shipment status (state machine)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.shipmentsService.updateStatus(id, dto, userId);
  }

  // ===========================
  // SOFT DELETE
  // ===========================
  @Delete(':id')
  @Permissions(Permission.SHIPMENTS_DELETE)
  @ApiOperation({ summary: 'Soft delete a shipment' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Shipment deleted' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.shipmentsService.softDelete(id);
  }

  // ===========================
  // STATUS HISTORY
  // ===========================
  @Get(':id/history')
  @Permissions(Permission.SHIPMENTS_VIEW_ALL)
  @ApiOperation({ summary: 'Get shipment status change history' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Status history list' })
  async getHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.shipmentsService.getHistory(id);
  }

  // ===========================
  // UPLOAD DOCUMENT
  // ===========================
  @Post(':id/documents')
  @Permissions(Permission.SHIPMENTS_EDIT)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  @ApiOperation({ summary: 'Upload a document for a shipment' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        type: {
          type: 'string',
          enum: ['LABEL', 'INVOICE', 'WAYBILL', 'PHOTO', 'OTHER'],
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Document uploaded' })
  async uploadDocument(
    @Param('id', ParseUUIDPipe) shipmentId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('sub') userId: string,
    @Body('type') documentType?: string,
  ) {
    return this.shipmentsService.uploadDocument(
      shipmentId,
      file,
      userId,
      documentType,
    );
  }

  // ===========================
  // DOWNLOAD LABEL (PDF)
  // ===========================
  @Get(':id/label')
  @Permissions(Permission.SHIPMENTS_VIEW_ALL)
  @ApiOperation({ summary: 'Generate and download shipment label (PDF)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'PDF label' })
  async getLabel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.labelService.generateLabel(id, userId);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="shipment-${id}-label.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  // ===========================
  // GET DOCUMENT URL
  // ===========================
  @Get('documents/:documentId')
  @Permissions(Permission.SHIPMENTS_VIEW_ALL)
  @ApiOperation({ summary: 'Get document download URL' })
  @ApiParam({ name: 'documentId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Document with download URL' })
  async getDocumentUrl(@Param('documentId', ParseUUIDPipe) documentId: string) {
    return this.shipmentsService.getDocumentUrl(documentId);
  }
}
