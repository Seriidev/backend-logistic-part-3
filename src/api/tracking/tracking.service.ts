import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TrackingGateway } from '../../gateways/tracking.gateway';
import { UpdateGpsDto } from './dto';
@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trackingGateway: TrackingGateway,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC: Get tracking info by tracking number (no auth required)
  // ─────────────────────────────────────────────────────────────────────────
  async getPublicTracking(trackingNumber: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { trackingNumber, isDeleted: false },
      select: {
        id: true,
        trackingNumber: true,
        status: true,
        originAddress: true,
        destinationAddress: true,
        description: true,
        weight: true,
        quantity: true,
        createdAt: true,
        updatedAt: true,
        events: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            status: true,
            note: true,
            latitude: true,
            longitude: true,
            createdAt: true,
          },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException(
        `Shipment with tracking number ${trackingNumber} not found`,
      );
    }

    return {
      ...shipment,
      estimatedDelivery: null, // ETA — Phase 2
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Get full timeline for a shipment (auth required)
  // ─────────────────────────────────────────────────────────────────────────
  async getTimeline(shipmentId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, isDeleted: false },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment ${shipmentId} not found`);
    }

    const events = await this.prisma.shipmentEvent.findMany({
      where: { shipmentId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, email: true, role: true },
        },
      },
    });

    return events;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Update GPS from driver
  // ─────────────────────────────────────────────────────────────────────────
  async updateGps(shipmentId: string, dto: UpdateGpsDto, userId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, isDeleted: false },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment ${shipmentId} not found`);
    }

    // Create a GPS event (reuses ShipmentEvent with current status + coordinates)
    const event = await this.prisma.shipmentEvent.create({
      data: {
        shipmentId,
        status: shipment.status,
        note: dto.note ?? 'GPS update',
        latitude: dto.latitude,
        longitude: dto.longitude,
        createdBy: userId,
      },
    });

    // Emit real-time update via WebSocket
    try {
      this.trackingGateway.emitTrackingUpdate(shipment.trackingNumber, {
        shipmentId,
        trackingNumber: shipment.trackingNumber,
        status: shipment.status,
        latitude: dto.latitude,
        longitude: dto.longitude,
        note: dto.note,
        timestamp: event.createdAt,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to emit tracking update: ${(err as Error).message}`,
      );
    }

    return event;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Get GPS history (all events with coordinates)
  // ─────────────────────────────────────────────────────────────────────────
  async getGpsHistory(shipmentId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, isDeleted: false },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment ${shipmentId} not found`);
    }

    const events = await this.prisma.shipmentEvent.findMany({
      where: {
        shipmentId,
        latitude: { not: null },
        longitude: { not: null },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        status: true,
        latitude: true,
        longitude: true,
        note: true,
        createdAt: true,
      },
    });

    return events;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ETA — placeholder for Phase 2
  // ─────────────────────────────────────────────────────────────────────────
  async getEta(shipmentId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, isDeleted: false },
      select: { id: true, trackingNumber: true, status: true },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment ${shipmentId} not found`);
    }

    return {
      shipmentId,
      trackingNumber: shipment.trackingNumber,
      status: shipment.status,
      estimatedDelivery: null, // AI-powered ETA — Phase 2
      message: 'ETA calculation will be available in Phase 2',
    };
  }
}
