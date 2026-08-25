import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { permissionsFor } from './permissions';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>(); const token = request.cookies?.[this.config.get<string>('AUTH_COOKIE_NAME') ?? 'bim4c_admin_session'] as string | undefined;
    if (!token || token.length < 32) throw new UnauthorizedException('Authentication required');
    const session = await this.prisma.adminSession.findUnique({ where: { tokenHash: createHash('sha256').update(token).digest('hex') }, include: { user: { include: { roles: true } } } });
    if (!session || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') throw new UnauthorizedException('Session expired');
    const roles = session.user.roles.map(item => item.role); request.admin = { id: session.user.id, email: session.user.email, name: session.user.name, roles, permissions: permissionsFor(roles), sessionId: session.id }; return true;
  }
}
