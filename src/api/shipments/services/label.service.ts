import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { StorageService } from '../../../integrations/storage/storage.service';
import { DocumentType } from '@prisma/client';
import * as QRCode from 'qrcode';

@Injectable()
export class LabelService {
  private readonly logger = new Logger(LabelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async generateLabel(shipmentId: string, userId: string): Promise<Buffer> {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, isDeleted: false },
      include: {
        sender: { select: { id: true, email: true } },
        recipient: { select: { id: true, email: true } },
      },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment ${shipmentId} not found`);
    }

    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(shipment.trackingNumber, {
      width: 150,
      margin: 1,
    });

    // Build PDF using pdfmake's server-side printer.
    // The package root only exposes the browser build, so we import the
    // server-side PdfPrinter, URLResolver and virtual filesystem directly.
    /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
    const PdfPrinter: any = require('pdfmake/js/Printer.js').default;
    const URLResolver: any = require('pdfmake/js/URLResolver.js').default;
    const vfs: any = require('pdfmake/js/virtual-fs.js').default;
    /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

    const fonts: Record<string, Record<string, string>> = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const urlResolver: any = new URLResolver(vfs);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const printer: any = new PdfPrinter(fonts, vfs, urlResolver);

    const docDefinition = {
      defaultStyle: { font: 'Helvetica' },
      pageSize: { width: 288, height: 432 } as const, // 4x6 inches
      pageMargins: [12, 12, 12, 12] as [number, number, number, number],
      content: [
        {
          text: 'YUUSELL LOGISTICS',
          style: 'header',
          alignment: 'center' as const,
        },
        {
          canvas: [
            {
              type: 'line' as const,
              x1: 0,
              y1: 5,
              x2: 264,
              y2: 5,
              lineWidth: 1,
            },
          ],
        },
        { text: '\n' },
        {
          image: qrDataUrl,
          width: 100,
          alignment: 'center' as const,
        },
        {
          text: shipment.trackingNumber,
          style: 'trackingNumber',
          alignment: 'center' as const,
          margin: [0, 8, 0, 8] as [number, number, number, number],
        },
        {
          canvas: [
            {
              type: 'line' as const,
              x1: 0,
              y1: 0,
              x2: 264,
              y2: 0,
              lineWidth: 0.5,
              dash: { length: 3, space: 2 },
            },
          ],
        },
        { text: '\n' },
        { text: 'FROM:', style: 'label' },
        {
          text: shipment.sender?.email || 'N/A',
          style: 'value',
        },
        {
          text: shipment.originAddress || 'No address provided',
          style: 'address',
        },
        { text: '\n' },
        { text: 'TO:', style: 'label' },
        {
          text: shipment.recipient?.email || 'N/A',
          style: 'value',
        },
        {
          text: shipment.destinationAddress || 'No address provided',
          style: 'address',
        },
        { text: '\n' },
        {
          canvas: [
            {
              type: 'line' as const,
              x1: 0,
              y1: 0,
              x2: 264,
              y2: 0,
              lineWidth: 0.5,
              dash: { length: 3, space: 2 },
            },
          ],
        },
        { text: '\n' },
        {
          columns: [
            {
              width: '*',
              text: [
                { text: 'Weight: ', style: 'label' },
                {
                  text: shipment.weight
                    ? `${String(shipment.weight)} kg`
                    : 'N/A',
                  style: 'value',
                },
              ],
            },
            {
              width: '*',
              text: [
                { text: 'Qty: ', style: 'label' },
                { text: `${shipment.quantity}`, style: 'value' },
              ],
            },
          ],
        },
        {
          text: shipment.dimensions ? `Dimensions: ${shipment.dimensions}` : '',
          style: 'smallText',
          margin: [0, 4, 0, 0] as [number, number, number, number],
        },
        shipment.description
          ? {
              text: `Description: ${shipment.description}`,
              style: 'smallText',
              margin: [0, 2, 0, 0] as [number, number, number, number],
            }
          : { text: '' },
        { text: '\n' },
        {
          text: `Status: ${shipment.status}`,
          style: 'status',
          alignment: 'center' as const,
        },
        {
          text: `Generated: ${new Date().toISOString().split('T')[0]}`,
          style: 'smallText',
          alignment: 'center' as const,
          margin: [0, 4, 0, 0] as [number, number, number, number],
        },
      ],
      styles: {
        header: { fontSize: 14, bold: true },
        trackingNumber: { fontSize: 16, bold: true },
        label: { fontSize: 8, bold: true, color: '#666666' },
        value: { fontSize: 10 },
        address: { fontSize: 9, color: '#333333' },
        smallText: { fontSize: 7, color: '#999999' },
        status: {
          fontSize: 11,
          bold: true,
          color: '#0066cc',
        },
      },
    };

    // Generate PDF buffer. In this pdfmake version createPdfKitDocument is
    // async (resolves URLs first), so we must await the returned promise.
    const pdfDoc: NodeJS.ReadableStream & { end: () => void } = await (
      printer as {
        createPdfKitDocument: (
          dd: unknown,
        ) => Promise<NodeJS.ReadableStream & { end: () => void }>;
      }
    ).createPdfKitDocument(docDefinition);
    const chunks: Buffer[] = [];

    return new Promise<Buffer>((resolve, reject) => {
      pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);

        // Store label in MinIO asynchronously
        void this.storeLabelAsync(shipmentId, pdfBuffer, userId);

        resolve(pdfBuffer);
      });
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });
  }

  private async storeLabelAsync(
    shipmentId: string,
    buffer: Buffer,
    userId: string,
  ) {
    try {
      const key = `shipments/${shipmentId}/labels/label.pdf`;
      await this.storageService.uploadFile(key, buffer, 'application/pdf');

      // Check if label document already exists, update or create
      const existingLabel = await this.prisma.document.findFirst({
        where: {
          shipmentId,
          type: DocumentType.LABEL,
        },
      });

      if (existingLabel) {
        await this.prisma.document.update({
          where: { id: existingLabel.id },
          data: {
            fileUrl: key,
            fileSize: buffer.length,
          },
        });
      } else {
        await this.prisma.document.create({
          data: {
            shipmentId,
            type: DocumentType.LABEL,
            fileName: 'shipment-label.pdf',
            fileUrl: key,
            fileSize: buffer.length,
            mimeType: 'application/pdf',
            uploadedBy: userId,
          },
        });
      }

      this.logger.log(`Label stored for shipment ${shipmentId}`);
    } catch (error) {
      this.logger.warn(
        `Failed to store label for shipment ${shipmentId}: ${(error as Error).message}`,
      );
    }
  }
}
