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
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (
      this.config.get<string>('NODE_ENV') === 'test' ||
      ['GET', 'HEAD', 'OPTIONS'].includes(request.method)
    )
      return true;
    const origin = request.headers.origin;
    const allowed = (
      this.config.get<string>('CORS_ORIGINS') ??
      this.config.get<string>('FRONTEND_URL') ??
      ''
    )
      .split(',')
      .map((x) => x.trim());
    if (!origin || !allowed.includes(origin))
      throw new ForbiddenException('Invalid request origin');
    return true;
  }
}
