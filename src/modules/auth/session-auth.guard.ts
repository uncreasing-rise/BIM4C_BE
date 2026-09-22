import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { permissionsFor } from './permissions';

interface CachedSession {
  admin: NonNullable<Request['admin']>;
  cachedAt: number;
}

const sessionCache = new Map<string, CachedSession>();
const CACHE_TTL_MS = 30_000; // 30 seconds

export function invalidateSessionCache(tokenHash?: string) {
  if (tokenHash) sessionCache.delete(tokenHash);
  else sessionCache.clear();
}

export function primeSessionCache(
  tokenHash: string,
  admin: NonNullable<Request['admin']>,
) {
  sessionCache.set(tokenHash, { admin, cachedAt: Date.now() });
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const cookieToken = request.cookies?.[
      this.config.get<string>('AUTH_COOKIE_NAME') ?? 'bim4c_admin_session'
    ] as string | undefined;
    const authorization = request.headers.authorization;
    const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const token = bearerToken ?? cookieToken;
    if (!token || token.length < 32)
      throw new UnauthorizedException('Authentication required');

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const now = Date.now();
    const cached = sessionCache.get(tokenHash);

    if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
      request.admin = cached.admin;
      return true;
    }

    const session = await this.prisma.adminSession.findUnique({
      where: { tokenHash },
      include: { user: { include: { roles: true } } },
    });
    if (
      !session ||
      session.expiresAt <= new Date() ||
      session.user.status !== 'ACTIVE'
    ) {
      sessionCache.delete(tokenHash);
      throw new UnauthorizedException('Session expired');
    }
    const roles = session.user.roles.map((item) => item.role);
    const adminData = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      roles,
      permissions: permissionsFor(roles),
      sessionId: session.id,
    };
    request.admin = adminData;
    primeSessionCache(tokenHash, adminData);
    return true;
  }
}
