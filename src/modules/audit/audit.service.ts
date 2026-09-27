import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  pageResponse,
  stableOrderBy,
} from '../../common/pagination/page-query.dto';
import type { AuditQueryDto } from './audit-query.dto';
export interface AuditInput {
  actorId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  requestId?: string;
  metadata?: Prisma.InputJsonValue;
}
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  record(input: AuditInput) {
    return this.prisma.auditLog.create({ data: input });
  }
  async list(query: AuditQueryDto) {
    const { page, limit, resource, action, search } = query;
    const where: Prisma.AuditLogWhereInput = {
      ...(resource ? { resource } : {}),
      ...(action ? { action } : {}),
      ...(search
        ? {
            OR: [
              { resource: { contains: search, mode: 'insensitive' } },
              { resourceId: { contains: search, mode: 'insensitive' } },
              { requestId: { contains: search, mode: 'insensitive' } },
              { actor: { name: { contains: search, mode: 'insensitive' } } },
              { actor: { email: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: stableOrderBy(
          query.sortBy ?? 'createdAt',
          query.sortOrder,
          [],
        ),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return pageResponse(data, total, page, limit);
  }
  async detail(id: string) {
    const row = await this.prisma.auditLog.findUnique({
      where: { id },
      include: { actor: { select: { id: true, name: true, email: true } } },
    });
    if (!row) throw new NotFoundException('Audit log not found');
    return row;
  }
}
