import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { type Observable, of } from 'rxjs';

/** The hidden form field people never see and bots fill in. */
export const HONEYPOT_FIELD = 'website';

/**
 * Public forms carry a hidden HONEYPOT_FIELD. Filled in, the submission is a
 * bot's: it gets the same success answer but nothing is stored and no email
 * is sent (the forms email the address they are given, which made them a
 * way to send BIM4C mail to anyone). Empty, the field is removed so the
 * strict validation never sees it. Runs before validation pipes.
 */
@Injectable()
export class HoneypotInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HoneypotInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { requestId?: string }>();
    const body = request.body as Record<string, unknown> | undefined;
    if (body && typeof body === 'object' && HONEYPOT_FIELD in body) {
      const value = body[HONEYPOT_FIELD];
      delete body[HONEYPOT_FIELD];
      if (typeof value === 'string' ? value.trim() : value) {
        this.logger.warn(
          JSON.stringify({
            event: 'form.honeypot',
            path: request.path,
            requestId: request.requestId,
          }),
        );
        const en = body.locale === 'en';
        return of({
          success: true,
          message: en
            ? 'Your request has been received.'
            : 'Yêu cầu của bạn đã được ghi nhận.',
        });
      }
    }
    return next.handle();
  }
}
