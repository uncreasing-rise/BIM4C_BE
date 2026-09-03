import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');
  use(
    request: Request & { requestId?: string },
    response: Response,
    next: NextFunction,
  ): void {
    const requestId =
      request.header('x-request-id')?.slice(0, 100) || randomUUID();
    const startedAt = Date.now();
    request.requestId = requestId;
    response.setHeader('X-Request-ID', requestId);
    response.on('finish', () =>
      this.logger.log(
        JSON.stringify({
          requestId,
          method: request.method,
          path: request.originalUrl,
          status: response.statusCode,
          durationMs: Date.now() - startedAt,
        }),
      ),
    );
    next();
  }
}
