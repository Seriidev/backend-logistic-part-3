import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  // TODO: Sprint 5 — SendGrid integration
  async sendEmail(_to: string, _subject: string, _html: string): Promise<void> {
    this.logger.warn('MailService.sendEmail — not yet implemented (mock mode)');
  }

  async sendPasswordReset(_to: string, _token: string): Promise<void> {
    this.logger.warn('MailService.sendPasswordReset — mock mode');
  }

  async sendShipmentUpdate(
    _to: string,
    _shipmentId: string,
    _status: string,
  ): Promise<void> {
    this.logger.warn('MailService.sendShipmentUpdate — mock mode');
  }
}
