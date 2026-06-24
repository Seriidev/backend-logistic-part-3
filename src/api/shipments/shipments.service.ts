import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../integrations/storage/storage.service';
import {
  CreateShipmentDto,
  UpdateShipmentDto,
  UpdateStatusDto,
  QueryShipmentsDto,
  BulkStatusDto,
} from './dto';
import { Prisma, ShipmentStatus, DocumentType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import 'multer';

// ============================================
// STATE MACHINE — Valid Transitions
// ============================================
const VALID_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  DRAFT: [ShipmentStatus.PENDING, ShipmentStatus.CANCELLED],
  PENDING: [ShipmentStatus.PROCESSING, ShipmentStatus.CANCELLED],
  PROCESSING: [ShipmentStatus.READY_FOR_PICKUP, ShipmentStatus.CANCELLED],
  READY_FOR_PICKUP: [ShipmentStatus.IN_TRANSIT, ShipmentStatus.CANCELLED],
  IN_TRANSIT: [ShipmentStatus.DELIVERED, ShipmentStatus.RETURNED],
  DELIVERED: [],
  RETURNED: [],
  CANCELLED: [],
};

@Injectable()
export class ShipmentsService {
  private readonly logger = new Logger(ShipmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  // ===========================
  // TRACKING NUMBER GENERATOR
  // ===========================
  private generateTrackingNumber(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'YU-';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // ===========================
  // CREATE SHIPMENT
  // ===========================
  async create(dto: CreateShipmentDto, userId: string) {
    // Generate unique tracking number (retry on collision)
    let trackingNumber: string;
    let attempts = 0;
    do {
      trackingNumber = this.generateTrackingNumber();
      const existing = await this.prisma.shipment.findUnique({
        where: { trackingNumber },
      });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      throw new BadRequestException(
        'Could not generate unique tracking number. Please try again.',
      );
    }

    const shipment = await this.prisma.shipment.create({
      data: {
        trackingNumber,
        senderId: dto.senderId,
        recipientId: dto.recipientId,
        description: dto.description,
        weight: dto.weight,
        dimensions: dto.dimensions,
        quantity: dto.quantity ?? 1,
        originAddress: dto.originAddress,
        destinationAddress: dto.destinationAddress,
        declaredValue: dto.declaredValue,
        shippingCost: dto.shippingCost,
        currency: dto.currency ?? 'USD',
        notes: dto.notes,
        status: ShipmentStatus.DRAFT,
      },
      include: {
        sender: { select: { id: true, email: true, role: true } },
        recipient: { select: { id: true, email: true, role: true } },
      },
    });

    // Create initial event
    await this.prisma.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        status: ShipmentStatus.DRAFT,
        note: 'Shipment created',
        createdBy: userId,
      },
    });

    this.logger.log(
      `Shipment created: ${shipment.trackingNumber} by user ${userId}`,
    );

    return shipment;
  }

  // ===========================
  // FIND ALL (with filters)
  // ===========================
  async findAll(query: QueryShipmentsDto) {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      senderId,
      recipientId,
      assignedDriverId,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.ShipmentWhereInput = {
      isDeleted: false,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { trackingNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (senderId) where.senderId = senderId;
    if (recipientId) where.recipientId = recipientId;
    if (assignedDriverId) where.assignedDriverId = assignedDriverId;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const allowedSortFields = [
      'createdAt',
      'updatedAt',
      'trackingNumber',
      'status',
    ];
    const orderField = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';

    const [data, total] = await Promise.all([
      this.prisma.shipment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [orderField]: sortOrder },
        include: {
          sender: { select: { id: true, email: true, role: true } },
          recipient: { select: { id: true, email: true, role: true } },
          assignedDriver: { select: { id: true, email: true, role: true } },
        },
      }),
      this.prisma.shipment.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ===========================
  // FIND ONE
  // ===========================
  async findOne(id: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id, isDeleted: false },
      include: {
        sender: { select: { id: true, email: true, role: true } },
        recipient: { select: { id: true, email: true, role: true } },
        assignedDriver: { select: { id: true, email: true, role: true } },
        events: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment ${id} not found`);
    }

    return shipment;
  }

  // ===========================
  // UPDATE SHIPMENT
  // ===========================
  async update(id: string, dto: UpdateShipmentDto) {
    await this.findOne(id); // ensure exists

    const shipment = await this.prisma.shipment.update({
      where: { id },
      data: {
        ...(dto.senderId && { senderId: dto.senderId }),
        ...(dto.recipientId !== undefined && {
          recipientId: dto.recipientId,
        }),
        ...(dto.assignedDriverId !== undefined && {
          assignedDriverId: dto.assignedDriverId,
        }),
        ...(dto.description !== undefined && {
          description: dto.description,
        }),
        ...(dto.weight !== undefined && { weight: dto.weight }),
        ...(dto.dimensions !== undefined && {
          dimensions: dto.dimensions,
        }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.originAddress !== undefined && {
          originAddress: dto.originAddress,
        }),
        ...(dto.destinationAddress !== undefined && {
          destinationAddress: dto.destinationAddress,
        }),
        ...(dto.declaredValue !== undefined && {
          declaredValue: dto.declaredValue,
        }),
        ...(dto.shippingCost !== undefined && {
          shippingCost: dto.shippingCost,
        }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: {
        sender: { select: { id: true, email: true, role: true } },
        recipient: { select: { id: true, email: true, role: true } },
        assignedDriver: { select: { id: true, email: true, role: true } },
      },
    });

    return shipment;
  }

  // ===========================
  // UPDATE STATUS (State Machine)
  // ===========================
  async updateStatus(id: string, dto: UpdateStatusDto, userId: string) {
    const shipment = await this.findOne(id);
    const currentStatus = shipment.status;
    const newStatus = dto.status as unknown as ShipmentStatus;

    // Validate transition
    const validNext = VALID_TRANSITIONS[currentStatus];
    if (!validNext || !validNext.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${currentStatus} → ${newStatus}. ` +
          `Valid transitions from ${currentStatus}: ${validNext?.join(', ') || 'none (final state)'}`,
      );
    }

    // Update status + create event in transaction
    const [updatedShipment] = await this.prisma.$transaction([
      this.prisma.shipment.update({
        where: { id },
        data: { status: newStatus },
        include: {
          sender: { select: { id: true, email: true, role: true } },
          recipient: { select: { id: true, email: true, role: true } },
          assignedDriver: {
            select: { id: true, email: true, role: true },
          },
        },
      }),
      this.prisma.shipmentEvent.create({
        data: {
          shipmentId: id,
          status: newStatus,
          note: dto.note,
          latitude: dto.latitude,
          longitude: dto.longitude,
          createdBy: userId,
        },
      }),
    ]);

    this.logger.log(
      `Shipment ${shipment.trackingNumber} status: ${currentStatus} → ${newStatus} by user ${userId}`,
    );

    return updatedShipment;
  }

  // ===========================
  // SOFT DELETE
  // ===========================
  async softDelete(id: string) {
    await this.findOne(id);

    await this.prisma.shipment.update({
      where: { id },
      data: { isDeleted: true },
    });

    return { message: `Shipment ${id} has been deleted` };
  }

  // ===========================
  // STATUS HISTORY
  // ===========================
  async getHistory(id: string) {
    await this.findOne(id); // ensure exists

    return this.prisma.shipmentEvent.findMany({
      where: { shipmentId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, role: true } },
      },
    });
  }

  // ===========================
  // BULK STATUS UPDATE
  // ===========================
  async bulkUpdateStatus(dto: BulkStatusDto, userId: string) {
    const results: Array<{
      shipmentId: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const item of dto.items) {
      try {
        await this.updateStatus(
          item.shipmentId,
          { status: item.status, note: item.note },
          userId,
        );
        results.push({ shipmentId: item.shipmentId, success: true });
      } catch (error) {
        results.push({
          shipmentId: item.shipmentId,
          success: false,
          error: (error as Error).message,
        });
      }
    }

    return {
      total: dto.items.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  // ===========================
  // UPLOAD DOCUMENT
  // ===========================
  async uploadDocument(
    shipmentId: string,
    file: Express.Multer.File,
    userId: string,
    documentType: string = 'OTHER',
  ) {
    await this.findOne(shipmentId);

    const key = `shipments/${shipmentId}/documents/${uuidv4()}-${file.originalname}`;

    await this.storageService.uploadFile(key, file.buffer, file.mimetype);

    const document = await this.prisma.document.create({
      data: {
        shipmentId,
        type: (documentType as DocumentType) || DocumentType.OTHER,
        fileName: file.originalname,
        fileUrl: key,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedBy: userId,
      },
    });

    return document;
  }

  // ===========================
  // GET DOCUMENT URL
  // ===========================
  async getDocumentUrl(documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    const url = await this.storageService.getFileUrl(document.fileUrl);
    return { ...document, downloadUrl: url };
  }

  // ===========================
  // STATS (for dashboard)
  // ===========================
  async getStats() {
    const [
      total,
      draft,
      pending,
      processing,
      readyForPickup,
      inTransit,
      delivered,
      returned,
      cancelled,
      revenueResult,
    ] = await Promise.all([
      this.prisma.shipment.count({ where: { isDeleted: false } }),
      this.prisma.shipment.count({
        where: { isDeleted: false, status: 'DRAFT' },
      }),
      this.prisma.shipment.count({
        where: { isDeleted: false, status: 'PENDING' },
      }),
      this.prisma.shipment.count({
        where: { isDeleted: false, status: 'PROCESSING' },
      }),
      this.prisma.shipment.count({
        where: { isDeleted: false, status: 'READY_FOR_PICKUP' },
      }),
      this.prisma.shipment.count({
        where: { isDeleted: false, status: 'IN_TRANSIT' },
      }),
      this.prisma.shipment.count({
        where: { isDeleted: false, status: 'DELIVERED' },
      }),
      this.prisma.shipment.count({
        where: { isDeleted: false, status: 'RETURNED' },
      }),
      this.prisma.shipment.count({
        where: { isDeleted: false, status: 'CANCELLED' },
      }),
      this.prisma.shipment.aggregate({
        where: { isDeleted: false },
        _sum: { shippingCost: true },
      }),
    ]);

    return {
      total,
      byStatus: {
        draft,
        pending,
        processing,
        readyForPickup,
        inTransit,
        delivered,
        returned,
        cancelled,
      },
      revenue: revenueResult._sum.shippingCost ?? 0,
    };
  }
}
