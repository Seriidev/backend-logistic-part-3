import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  // TODO: Phase 2 — Google Vision API / Tesseract OCR integration
}
