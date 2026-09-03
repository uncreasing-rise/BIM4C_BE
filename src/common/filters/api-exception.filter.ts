import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
interface ValidationBody {
  message?: string | string[];
  code?: string;
  errors?: Record<string, string[]>;
}
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request & { requestId?: string }>();
    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = isHttp ? exception.getResponse() : undefined;
    const body =
      typeof raw === 'object' && raw !== null
        ? (raw as ValidationBody)
        : undefined;
    const validationMessages = Array.isArray(body?.message)
      ? body.message
      : undefined;
    const message = validationMessages
      ? 'Validation failed'
      : typeof body?.message === 'string'
        ? body.message
        : typeof raw === 'string'
          ? raw
          : 'Internal server error';
    const code =
      body?.code ??
      (validationMessages
        ? 'VALIDATION_ERROR'
        : status === 404
          ? 'NOT_FOUND'
          : status === 409
            ? 'CONFLICT'
            : status === 429
              ? 'RATE_LIMITED'
              : status >= 500
                ? 'INTERNAL_ERROR'
                : 'REQUEST_ERROR');
    const errors =
      body?.errors ??
      (validationMessages ? { request: validationMessages } : undefined);
    if (!isHttp)
      this.logger.error(
        `${request.method} ${request.originalUrl}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    response
      .status(status)
      .json({
        message,
        code,
        ...(errors ? { errors } : {}),
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
        path: request.originalUrl,
      });
  }
}
