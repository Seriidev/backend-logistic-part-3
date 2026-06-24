import { Logger } from '@nestjs/common';

// TODO: Sprint 5 — implement Bull processor for email queue
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);
}
