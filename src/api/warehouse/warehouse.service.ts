import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  ReceiveShipmentDto,
  ScanBarcodeDto,
  UpdateLocationDto,
  OutboundShipmentDto,
} from './dto';
import { ShipmentStatus } from '@prisma/client';

@Injectable()
export class WarehouseService {
  private readonly logger = new Logger(WarehouseService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // RECEIVE — accept shipment into warehouse
  // ─────────────────────────────────────────────────────────────────────────
  async receive(dto: ReceiveShipmentDto, userId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: dto.shipmentId, isDeleted: false },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment ${dto.shipmentId} not found`);
    }

    // Only PENDING shipments can be received
    if (shipment.status !== ShipmentStatus.PENDING) {
      throw new BadRequestException(
        `Shipment must be in PENDING status to receive. Current: ${shipment.status}`,
      );
    }

    // Check if already in warehouse
    const existing = await this.prisma.warehouseItem.findUnique({
      where: { shipmentId: dto.shipmentId },
    });
    if (existing) {
      throw new BadRequestException(
        `Shipment ${dto.shipmentId} is already in the warehouse`,
      );
    }

    // Create warehouse item + advance status in a transaction
    const [warehouseItem] = await this.prisma.$transaction([
      this.prisma.warehouseItem.create({
        data: {
          shipmentId: dto.shipmentId,
          location: dto.location,
          barcode: dto.barcode,
          notes: dto.notes,
        },
        include: { shipment: true },
      }),
      this.prisma.shipment.update({
        where: { id: dto.shipmentId },
        data: { status: ShipmentStatus.PROCESSING },
      }),
      this.prisma.shipmentEvent.create({
        data: {
          shipmentId: dto.shipmentId,
          status: ShipmentStatus.PROCESSING,
          note: `Received in warehouse${dto.location ? ` at ${dto.location}` : ''}`,
          createdBy: userId,
        },
      }),
    ]);

    this.logger.log(
      `Shipment ${dto.shipmentId} received in warehouse by user ${userId}`,
    );

    return warehouseItem;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCAN — look up shipment by barcode
  // ─────────────────────────────────────────────────────────────────────────
  async scan(dto: ScanBarcodeDto) {
    const warehouseItem = await this.prisma.warehouseItem.findFirst({
      where: { barcode: dto.barcode },
      include: {
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
            status: true,
            description: true,
            originAddress: true,
            destinationAddress: true,
            weight: true,
            quantity: true,
          },
        },
      },
    });

    if (!warehouseItem) {
      throw new NotFoundException(
        `No warehouse item found with barcode: ${dto.barcode}`,
      );
    }

    return warehouseItem;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INVENTORY — list all active warehouse items
  // ─────────────────────────────────────────────────────────────────────────
  async getInventory(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.warehouseItem.findMany({
        where: { outboundAt: null },
        skip,
        take: limit,
        orderBy: { receivedAt: 'desc' },
        include: {
          shipment: {
            select: {
              id: true,
              trackingNumber: true,
              status: true,
              description: true,
              originAddress: true,
              destinationAddress: true,
              weight: true,
            },
          },
        },
      }),
      this.prisma.warehouseItem.count({ where: { outboundAt: null } }),
    ]);

    return {
      data: items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE LOCATION — move item to a different cell
  // ─────────────────────────────────────────────────────────────────────────
  async updateLocation(id: string, dto: UpdateLocationDto, userId: string) {
    const item = await this.prisma.warehouseItem.findUnique({ where: { id } });

    if (!item) {
      throw new NotFoundException(`Warehouse item ${id} not found`);
    }

    const updated = await this.prisma.warehouseItem.update({
      where: { id },
      data: { location: dto.location },
      include: { shipment: { select: { id: true, trackingNumber: true } } },
    });

    this.logger.log(
      `Warehouse item ${id} moved to ${dto.location} by user ${userId}`,
    );

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OUTBOUND — hand off shipment to driver / customer
  // ─────────────────────────────────────────────────────────────────────────
  async outbound(dto: OutboundShipmentDto, userId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: dto.shipmentId, isDeleted: false },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment ${dto.shipmentId} not found`);
    }

    if (shipment.status !== ShipmentStatus.PROCESSING) {
      throw new BadRequestException(
        `Shipment must be in PROCESSING status for outbound. Current: ${shipment.status}`,
      );
    }

    const warehouseItem = await this.prisma.warehouseItem.findUnique({
      where: { shipmentId: dto.shipmentId },
    });

    if (!warehouseItem) {
      throw new NotFoundException(
        `No warehouse item found for shipment ${dto.shipmentId}`,
      );
    }

    const now = new Date();

    const [updatedItem] = await this.prisma.$transaction([
      this.prisma.warehouseItem.update({
        where: { shipmentId: dto.shipmentId },
        data: { outboundAt: now, notes: dto.notes ?? warehouseItem.notes },
        include: { shipment: true },
      }),
      this.prisma.shipment.update({
        where: { id: dto.shipmentId },
        data: { status: ShipmentStatus.READY_FOR_PICKUP },
      }),
      this.prisma.shipmentEvent.create({
        data: {
          shipmentId: dto.shipmentId,
          status: ShipmentStatus.READY_FOR_PICKUP,
          note: dto.notes ?? 'Outbound from warehouse — ready for pickup',
          createdBy: userId,
        },
      }),
    ]);

    this.logger.log(
      `Shipment ${dto.shipmentId} outbound from warehouse by user ${userId}`,
    );

    return updatedItem;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REPORTS — summary stats
  // ─────────────────────────────────────────────────────────────────────────
  async getReports() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalInStock, receivedToday, outboundToday] =
      await this.prisma.$transaction([
        this.prisma.warehouseItem.count({ where: { outboundAt: null } }),
        this.prisma.warehouseItem.count({
          where: { receivedAt: { gte: today } },
        }),
        this.prisma.warehouseItem.count({
          where: { outboundAt: { gte: today } },
        }),
      ]);

    return {
      totalInStock,
      receivedToday,
      outboundToday,
      generatedAt: new Date(),
    };
  }
}
