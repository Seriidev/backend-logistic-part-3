import { randomBytes, randomUUID } from 'crypto';

export function generateTrackingNumber(prefix: string = 'YUU'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export function generateResetToken(): string {
  return randomBytes(32).toString('hex');
}

export function generateUUID(): string {
  return randomUUID();
}
