import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client;
  private bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('storage.bucket', 'yuusell');
    this.client = new Minio.Client({
      endPoint: this.configService.get<string>('storage.endpoint', 'localhost'),
      port: this.configService.get<number>('storage.port', 9000),
      useSSL: this.configService.get<boolean>('storage.useSSL', false),
      accessKey: this.configService.get<string>(
        'storage.accessKey',
        'minioadmin',
      ),
      secretKey: this.configService.get<string>(
        'storage.secretKey',
        'minioadmin',
      ),
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Bucket "${this.bucket}" created`);
      } else {
        this.logger.log(`Bucket "${this.bucket}" already exists`);
      }
    } catch (error) {
      this.logger.warn(
        `Could not connect to MinIO: ${(error as Error).message}. File operations will fail until MinIO is available.`,
      );
    }
  }

  async uploadFile(
    key: string,
    buffer: Buffer,
    mimeType?: string,
  ): Promise<string> {
    const metaData: Record<string, string> = {};
    if (mimeType) {
      metaData['Content-Type'] = mimeType;
    }

    await this.client.putObject(
      this.bucket,
      key,
      buffer,
      buffer.length,
      metaData,
    );
    this.logger.log(`File uploaded: ${key}`);
    return key;
  }

  async getFileUrl(key: string, expirySeconds = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, expirySeconds);
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async deleteFile(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
    this.logger.log(`File deleted: ${key}`);
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch {
      return false;
    }
  }
}
