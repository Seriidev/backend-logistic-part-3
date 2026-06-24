import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only log mutations
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next.handle();
    }

    const user = request.user;
    const action = `${method} ${request.url}`;
    const entity = context.getClass().name;

    return next.handle().pipe(
      tap(() => {
        this.prisma.auditLog
          .create({
            data: {
              userId: user?.sub || null,
              action,
              entity,
              entityId: request.params?.id || null,
              payload: request.body || null,
              ip: request.ip || null,
              userAgent: request.headers?.['user-agent'] || null,
            },
          })
          .catch((error: Error) => {
            this.logger.error(`Failed to create audit log: ${error.message}`);
          });
      }),
    );
  }
}
