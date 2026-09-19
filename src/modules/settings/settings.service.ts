import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { UpdateSettingsDto } from './settings.dto';
@Injectable()
export class SettingsService {
  private publicCache: { data: any; cachedAt: number } | null = null;
  private settingsCache: { data: any; cachedAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}
  async get() {
    const now = Date.now();
    if (this.settingsCache && now - this.settingsCache.cachedAt < 120_000) {
      return this.settingsCache.data;
    }
    const row = await this.prisma.siteSettings.findUniqueOrThrow({
      where: { id: 'default' },
    });
    this.settingsCache = { data: row, cachedAt: now };
    return row;
  }
  async update(dto: UpdateSettingsDto, actorId: string, requestId?: string) {
    this.publicCache = null;
    this.settingsCache = null;
    const data: Prisma.SiteSettingsUpdateInput = {
      companyName: dto.companyName,
      email: dto.email,
      phone: dto.phone,
      address: dto.address,
      brochureUrl: dto.brochureUrl,
      metrics: (dto.metrics as Prisma.InputJsonValue) ?? undefined,
      socialLinks: dto.socialLinks,
      defaultSeoTitle: dto.defaultSeoTitle,
      defaultSeoDescription: dto.defaultSeoDescription,
      defaultOgImage: dto.defaultOgImage,
    };
    const row = await this.prisma.siteSettings.update({
      where: { id: 'default' },
      data,
    });
    void this.audit.record({
      actorId,
      action: AuditAction.SETTINGS_UPDATE,
      resource: 'settings',
      resourceId: 'default',
      requestId,
    }).catch(() => {});
    return row;
  }
  async public() {
    const now = Date.now();
    if (this.publicCache && now - this.publicCache.cachedAt < 120_000) {
      return this.publicCache.data;
    }
    const x = await this.get();
    const data = {
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
    this.publicCache = { data, cachedAt: now };
    return data;
  }
}
