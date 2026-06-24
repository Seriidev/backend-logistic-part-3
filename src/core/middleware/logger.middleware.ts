import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction) {
    const { method, originalUrl, ip } = request;
    const userAgent = request.headers['user-agent'] || '-';
    const correlationId = request.headers['x-correlation-id'] || '-';
    const contentLength = request.headers['content-length'] || '0';
    const startTime = Date.now();

    response.on('finish', () => {
      const { statusCode } = response;
      const duration = Date.now() - startTime;
      const user = (request as Request & { user?: { sub: string } }).user;
      const userId = user?.sub || 'anonymous';

      const logMessage = [
        `${method} ${originalUrl}`,
        `${statusCode}`,
        `${duration}ms`,
        `IP:${ip}`,
        `User:${userId}`,
        `CID:${correlationId as string}`,
        `Body:${contentLength}B`,
        `UA:${userAgent}`,
      ].join(' | ');

      if (statusCode >= 500) {
        this.logger.error(logMessage);
      } else if (statusCode >= 400) {
        this.logger.warn(logMessage);
      } else {
        this.logger.log(logMessage);
      }
    });

    next();
  }
}
