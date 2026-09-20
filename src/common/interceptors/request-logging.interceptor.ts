import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, catchError, tap, throwError } from 'rxjs';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { requestId?: string }>();
    const response = http.getResponse<Response>();

    const method = String(request.method ?? 'GET').toUpperCase();
    const url = String(request.originalUrl ?? request.url ?? '');
    const requestId = String(request.requestId ?? request.headers['x-request-id'] ?? '-');
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - startedAt;
        const statusCode = response.statusCode;
        this.logger.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          event: 'http.request.completed',
          requestId,
          method,
          path: url,
          status: statusCode,
          durationMs,
        }));
      }),
      catchError((error: unknown) => {
        const durationMs = Date.now() - startedAt;
        const statusCode =
          error instanceof HttpException ? error.getStatus() : 500;
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        this.logger.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          event: 'http.request.failed',
          requestId,
          method,
          path: url,
          status: statusCode,
          durationMs,
          error: errorMessage,
        }), error instanceof Error ? error.stack : undefined);
        return throwError(() => error);
      }),
    );
  }
}
