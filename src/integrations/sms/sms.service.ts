import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  // TODO: Sprint 5 — Twilio integration
  async sendSms(_to: string, _message: string): Promise<void> {
    this.logger.warn('SmsService.sendSms — not yet implemented (mock mode)');
  }

  async sendOtp(_to: string, _code: string): Promise<void> {
    this.logger.warn('SmsService.sendOtp — mock mode');
  }
}
