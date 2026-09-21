import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (
      this.config.get<string>('NODE_ENV') === 'test' ||
      ['GET', 'HEAD', 'OPTIONS'].includes(request.method)
    ) {
      return true;
    }

    const origin = request.headers.origin;
    if (!origin) {
      const referer = request.headers.referer;
      if (referer) {
        try {
          const refOrigin = new URL(referer).origin;
          if (this.isAllowedOrigin(refOrigin)) return true;
        } catch {}
      }
      return true;
    }

    if (!this.isAllowedOrigin(origin)) {
      throw new ForbiddenException('Invalid request origin');
    }
    return true;
  }

  private isAllowedOrigin(origin: string): boolean {
    const cleanOrigin = origin.replace(/\/$/, '').toLowerCase();

    const allowed = (
      this.config.get<string>('CORS_ORIGINS') ??
      this.config.get<string>('FRONTEND_URL') ??
      ''
    )
      .split(',')
      .map((x) => x.trim().replace(/\/$/, '').toLowerCase())
      .filter(Boolean);

    if (allowed.includes(cleanOrigin)) return true;

    // Check trusted BIM4C & Vercel deployment domains
    try {
      const url = new URL(cleanOrigin);
      const hostname = url.hostname;
      if (
        hostname === 'bim4c.vn' ||
        hostname.endsWith('.bim4c.vn') ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('.vercel.app')
      ) {
        return true;
      }
    } catch {}

    return false;
  }
}
