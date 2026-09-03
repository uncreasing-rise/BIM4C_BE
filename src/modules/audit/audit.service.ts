import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { pageResponse } from '../../common/pagination/page-query.dto';
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
  async list(
    page: number,
    limit: number,
    resource?: string,
    action?: AuditAction,
  ) {
    const where = {
      ...(resource ? { resource } : {}),
      ...(action ? { action } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
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
