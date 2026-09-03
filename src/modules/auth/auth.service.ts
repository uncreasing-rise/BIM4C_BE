import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { permissionsFor } from './permissions';
import type { LoginDto } from './auth.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}
  async login(input: LoginDto, requestId?: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { email: input.email },
      include: { roles: true },
    });
    if (
      !user ||
      user.status !== 'ACTIVE' ||
      !(await compare(input.password, user.passwordHash))
    )
      throw new UnauthorizedException('Invalid email or password');
    const token = randomBytes(48).toString('base64url');
    const ttl = this.config.get<number>('AUTH_SESSION_TTL_HOURS') ?? 8;
    const session = await this.prisma.$transaction(async (tx) => {
      await tx.adminSession.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      const created = await tx.adminSession.create({
        data: {
          userId: user.id,
          tokenHash: createHash('sha256').update(token).digest('hex'),
          expiresAt: new Date(Date.now() + ttl * 3600000),
        },
      });
      await tx.adminUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
      return created;
    });
    await this.audit.record({
      actorId: user.id,
      action: AuditAction.LOGIN,
      resource: 'auth',
      resourceId: session.id,
      requestId,
    });
    return {
      token,
      maxAge: ttl * 3600,
      user: this.publicUser(user, session.id),
    };
  }
  async logout(sessionId: string, actorId: string, requestId?: string) {
    await this.prisma.adminSession.deleteMany({
      where: { id: sessionId, userId: actorId },
    });
    await this.audit.record({
      actorId,
      action: AuditAction.LOGOUT,
      resource: 'auth',
      resourceId: sessionId,
      requestId,
    });
  }
  async changePassword(
    userId: string,
    sessionId: string,
    currentPassword: string,
    newPassword: string,
    requestId?: string,
  ) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
    });
    if (!user || !(await compare(currentPassword, user.passwordHash)))
      throw new UnauthorizedException('Current password is incorrect');
    if (await compare(newPassword, user.passwordHash))
      throw new UnauthorizedException('New password must be different');
    await this.prisma.$transaction([
      this.prisma.adminUser.update({
        where: { id: userId },
        data: { passwordHash: await hash(newPassword, 12) },
      }),
      this.prisma.adminSession.deleteMany({
        where: { userId, id: { not: sessionId } },
      }),
    ]);
    await this.audit.record({
      actorId: userId,
      action: AuditAction.UPDATE,
      resource: 'auth.password',
      resourceId: userId,
      requestId,
    });
  }
  publicUser(
    user: {
      id: string;
      email: string;
      name: string;
      roles: { role: 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR' }[];
    },
    sessionId: string,
  ) {
    const roles = user.roles.map((x) => x.role);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles,
      permissions: permissionsFor(roles),
      sessionId,
    };
  }
}
