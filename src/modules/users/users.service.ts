import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminRole, AuditAction, Prisma, UserStatus } from '@prisma/client';
import { hash } from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import type {
  CreateAdminUserDto,
  UpdateAdminUserDto,
  UserQueryDto,
} from './users.dto';
import type { AuthenticatedAdmin } from '../auth/auth.types';
import { invalidateSessionCache } from '../auth/session-auth.guard';

/** Who is making the change. */
export type UserActor = Pick<AuthenticatedAdmin, 'id' | 'roles' | 'sessionId'>;

const SUPER: AdminRole = 'SUPER_ADMIN';

/**
 * ADMIN and SUPER_ADMIN share every other permission; the difference is
 * here: only a super admin may create, grant, edit, reset the password of,
 * re-role or disable a super admin account. Without it an ADMIN could make
 * themselves super admin or take over one by resetting its password.
 */
export function assertCanManage(
  actor: Pick<UserActor, 'roles'>,
  targetRoles: AdminRole[],
  nextRoles: AdminRole[] = [],
) {
  if (actor.roles.includes(SUPER)) return;
  if (targetRoles.includes(SUPER) || nextRoles.includes(SUPER))
    throw new ForbiddenException(
      'Only a super admin can manage super admin accounts',
    );
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}
  private select = {
    id: true,
    email: true,
    name: true,
    status: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
    roles: { select: { role: true } },
  } as const;
  async list(q: UserQueryDto) {
    const where: Prisma.AdminUserWhereInput = {
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { email: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.role ? { roles: { some: { role: q.role } } } : {}),
    };
    return {
      data: await this.prisma.adminUser.findMany({
        where,
        select: this.select,
        orderBy: { createdAt: 'desc' },
      }),
    };
  }
  async detail(id: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id },
      select: this.select,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
  async create(dto: CreateAdminUserDto, actor: UserActor, requestId?: string) {
    assertCanManage(actor, [], dto.roles);
    const actorId = actor.id;
    try {
      const user = await this.prisma.adminUser.create({
        data: {
          email: dto.email,
          name: dto.name,
          passwordHash: await hash(dto.password, 12),
          roles: { create: dto.roles.map((role) => ({ role })) },
        },
        select: this.select,
      });
      await this.audit.record({
        actorId,
        action: AuditAction.CREATE,
        resource: 'users',
        resourceId: user.id,
        requestId,
      });
      return user;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ConflictException('Email already exists');
      throw e;
    }
  }
  async update(
    id: string,
    dto: UpdateAdminUserDto,
    actor: UserActor,
    requestId?: string,
  ) {
    const current = await this.detail(id);
    const { password, roles, ...data } = dto;
    assertCanManage(
      actor,
      current.roles.map((r) => r.role),
      roles,
    );
    const user = await this.prisma.adminUser.update({
      where: { id },
      data: {
        ...data,
        ...(password
          ? {
              passwordHash: await hash(password, 12),
              // A reset password must lock out whoever had the old one; an
              // admin resetting their own keeps the session they are using.
              sessions: {
                deleteMany: id === actor.id ? { id: { not: actor.sessionId } } : {},
              },
            }
          : {}),
      },
      select: this.select,
    });
    if (password) invalidateSessionCache();
    if (roles) await this.roles(id, roles, actor, requestId);
    const actorId = actor.id;
    await this.audit.record({
      actorId,
      action: AuditAction.UPDATE,
      resource: 'users',
      resourceId: id,
      requestId,
    });
    return user;
  }
  async status(
    id: string,
    status: UserStatus,
    actor: UserActor,
    requestId?: string,
  ) {
    const actorId = actor.id;
    const target = await this.detail(id);
    assertCanManage(
      actor,
      target.roles.map((r) => r.role),
    );
    await this.protectLastSuper(id, status === 'DISABLED', undefined);
    const user = await this.prisma.adminUser.update({
      where: { id },
      data: {
        status,
        ...(status === 'DISABLED' ? { sessions: { deleteMany: {} } } : {}),
      },
      select: this.select,
    });
    if (status === 'DISABLED') invalidateSessionCache();
    await this.audit.record({
      actorId,
      action: AuditAction.UPDATE,
      resource: 'users',
      resourceId: id,
      requestId,
      metadata: { status },
    });
    return user;
  }
  async roles(
    id: string,
    roles: AdminRole[],
    actor: UserActor,
    requestId?: string,
  ) {
    const actorId = actor.id;
    const target = await this.detail(id);
    assertCanManage(
      actor,
      target.roles.map((r) => r.role),
      roles,
    );
    await this.protectLastSuper(id, false, roles);
    await this.prisma.$transaction([
      this.prisma.adminUserRole.deleteMany({ where: { userId: id } }),
      this.prisma.adminUserRole.createMany({
        data: roles.map((role) => ({ userId: id, role })),
      }),
    ]);
    await this.audit.record({
      actorId,
      action: AuditAction.ROLE_CHANGE,
      resource: 'users',
      resourceId: id,
      requestId,
      metadata: { roles },
    });
    return this.detail(id);
  }
  private async protectLastSuper(
    id: string,
    disable: boolean,
    nextRoles?: AdminRole[],
  ) {
    const current = await this.prisma.adminUser.findUnique({
      where: { id },
      include: { roles: true },
    });
    if (!current) throw new NotFoundException('User not found');
    const removing =
      current.roles.some((x) => x.role === 'SUPER_ADMIN') &&
      (disable || (!!nextRoles && !nextRoles.includes('SUPER_ADMIN')));
    if (
      removing &&
      (await this.prisma.adminUser.count({
        where: { status: 'ACTIVE', roles: { some: { role: 'SUPER_ADMIN' } } },
      })) <= 1
    )
      throw new ForbiddenException(
        'Cannot disable or demote the last super admin',
      );
  }
}
