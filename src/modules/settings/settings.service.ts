import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { UpdateSettingsDto } from './settings.dto';
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}
  get() {
    return this.prisma.siteSettings.findUniqueOrThrow({
      where: { id: 'default' },
    });
  }
  async update(dto: UpdateSettingsDto, actorId: string, requestId?: string) {
    const data: Record<string, unknown> = { ...dto };
    const row = await this.prisma.siteSettings.update({
      where: { id: 'default' },
      data: data as any,
    });
    await this.audit.record({
      actorId,
      action: AuditAction.SETTINGS_UPDATE,
      resource: 'settings',
      resourceId: 'default',
      requestId,
    });
    return row;
  }
  async public() {
    const x = await this.get();
    return {
      companyName: x.companyName,
      email: x.email,
      phone: x.phone,
      address: x.address,
      brochureUrl: x.brochureUrl,
      metrics: x.metrics,
      socialLinks: x.socialLinks,
      defaultSeoTitle: x.defaultSeoTitle,
      defaultSeoDescription: x.defaultSeoDescription,
      defaultOgImage: x.defaultOgImage,
    };
  }
}
