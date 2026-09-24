import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function normalizeOrigin(value: string): string | undefined {
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * Cross-site request forgery protection for cookie-authenticated mutations.
 *
 * Browsers attach the session cookie automatically, so every unsafe request
 * that relies on it must prove it came from an allowed origin. Requests that
 * authenticate only with an explicit `Authorization: Bearer` header cannot be
 * forged cross-site (browsers never add that header on their own) and are
 * therefore exempt.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (
      this.config.get<string>('NODE_ENV') === 'test' ||
      SAFE_METHODS.has(request.method)
    )
      return true;

    const hasBearer = /^Bearer\s+\S+/i.test(
      request.headers?.authorization ?? '',
    );
    const cookieName =
      this.config.get<string>('AUTH_COOKIE_NAME') ?? 'bim4c_admin_session';
    const hasCookie = Boolean(
      (request.cookies as Record<string, unknown> | undefined)?.[cookieName],
    );
    if (hasBearer && !hasCookie) return true;

    const origin =
      request.headers?.origin ??
      (request.headers?.referer
        ? normalizeOrigin(request.headers.referer)
        : undefined);
    if (!origin) {
      // Non-browser tooling in development may omit Origin; production never
      // accepts a cookie-authenticated mutation without one.
      if (this.config.get<string>('NODE_ENV') === 'production')
        throw new ForbiddenException('Missing request origin');
      return true;
    }
    if (!this.isAllowedOrigin(origin))
      throw new ForbiddenException('Invalid request origin');
    return true;
  }

  isAllowedOrigin(origin: string): boolean {
    const clean = normalizeOrigin(origin);
    if (!clean) return false;
    const allowed = (
      this.config.get<string>('CORS_ORIGINS') ??
      this.config.get<string>('FRONTEND_URL') ??
      ''
    )
      .split(',')
      .map((value) => normalizeOrigin(value.trim()))
      .filter((value): value is string => Boolean(value));
    if (allowed.includes(clean)) return true;
    if (this.config.get<string>('NODE_ENV') === 'production') return false;
    return LOCAL_HOSTS.has(new URL(clean).hostname);
  }
}
