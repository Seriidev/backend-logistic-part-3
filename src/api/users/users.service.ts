import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole, ShipmentStatus } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // LIST DRIVERS — all users with role DRIVER
  // ─────────────────────────────────────────────────────────────────────────
  async listDrivers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [drivers, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: { role: UserRole.DRIVER, isActive: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: {
              driverShipments: {
                where: {
                  status: {
                    in: [
                      ShipmentStatus.IN_TRANSIT,
                      ShipmentStatus.READY_FOR_PICKUP,
                    ],
                  },
                  isDeleted: false,
                },
              },
            },
          },
        },
      }),
      this.prisma.user.count({
        where: { role: UserRole.DRIVER, isActive: true },
      }),
    ]);

    return {
      data: drivers,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET DRIVER — profile + assigned shipments
  // ─────────────────────────────────────────────────────────────────────────
  async getDriver(id: string) {
    const driver = await this.prisma.user.findFirst({
      where: { id, role: UserRole.DRIVER },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        driverShipments: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            trackingNumber: true,
            status: true,
            originAddress: true,
            destinationAddress: true,
            createdAt: true,
            events: {
              where: {
                latitude: { not: null },
                longitude: { not: null },
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                latitude: true,
                longitude: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException(`Driver ${id} not found`);
    }

    return driver;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ASSIGN DRIVER — set assignedDriverId on a shipment
  // ─────────────────────────────────────────────────────────────────────────
  async assignDriver(shipmentId: string, driverId: string) {
    // Verify driver exists
    const driver = await this.prisma.user.findFirst({
      where: { id: driverId, role: UserRole.DRIVER },
    });
    if (!driver) {
      throw new NotFoundException(`Driver ${driverId} not found`);
    }

    // Verify shipment exists and is in a valid state for assignment
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, isDeleted: false },
    });
    if (!shipment) {
      throw new NotFoundException(`Shipment ${shipmentId} not found`);
    }

    const assignableStatuses: ShipmentStatus[] = [
      ShipmentStatus.PENDING,
      ShipmentStatus.PROCESSING,
      ShipmentStatus.READY_FOR_PICKUP,
      ShipmentStatus.IN_TRANSIT,
    ];
    if (!assignableStatuses.includes(shipment.status)) {
      throw new BadRequestException(
        `Cannot assign driver to shipment in status: ${shipment.status}`,
      );
    }

    const updated = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { assignedDriverId: driverId },
      select: {
        id: true,
        trackingNumber: true,
        status: true,
        assignedDriverId: true,
        assignedDriver: {
          select: { id: true, email: true, phone: true },
        },
      },
    });

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UNASSIGN DRIVER — remove driver from shipment
  // ─────────────────────────────────────────────────────────────────────────
  async unassignDriver(shipmentId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, isDeleted: false },
    });
    if (!shipment) {
      throw new NotFoundException(`Shipment ${shipmentId} not found`);
    }

    const updated = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { assignedDriverId: null },
      select: {
        id: true,
        trackingNumber: true,
        status: true,
        assignedDriverId: true,
      },
    });

    return updated;
  }
}
