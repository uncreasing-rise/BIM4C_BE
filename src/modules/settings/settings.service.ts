import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma, type SiteSettings } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { UpdateSettingsDto } from './settings.dto';
@Injectable()
export class SettingsService {
  private publicCache: {
    data: Partial<SiteSettings>;
    cachedAt: number;
  } | null = null;
  private settingsCache: { data: SiteSettings; cachedAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}
  async get(): Promise<SiteSettings> {
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
  async update(
    dto: UpdateSettingsDto,
    actorId: string,
    requestId?: string,
  ): Promise<SiteSettings> {
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
      defaultSeoTitle_vi: dto.defaultSeoTitle_vi?.trim() || null,
      defaultSeoDescription_vi: dto.defaultSeoDescription_vi?.trim() || null,
      defaultOgImage: dto.defaultOgImage,
    };
    const row = await this.prisma.siteSettings.update({
      where: { id: 'default' },
      data,
    });
    void this.audit
      .record({
        actorId,
        action: AuditAction.SETTINGS_UPDATE,
        resource: 'settings',
        resourceId: 'default',
        requestId,
      })
      .catch(() => {});
    return row;
  }
  /** Null when the settings row was deleted, so public pages hide contact data instead of failing. */
  async public(): Promise<Partial<SiteSettings> | null> {
    const now = Date.now();
    if (this.publicCache && now - this.publicCache.cachedAt < 120_000) {
      return this.publicCache.data;
    }
    const x = await this.prisma.siteSettings.findUnique({
      where: { id: 'default' },
    });
    if (!x) return null;
    // The registered company name and the brochure (company profile PDF) are
    // not published: legal-entity details stay admin-only.
    const data = {
      email: x.email,
      phone: x.phone,
      address: x.address,
      metrics: x.metrics,
      socialLinks: x.socialLinks,
      defaultSeoTitle: x.defaultSeoTitle,
      defaultSeoDescription: x.defaultSeoDescription,
      defaultSeoTitle_vi: x.defaultSeoTitle_vi,
      defaultSeoDescription_vi: x.defaultSeoDescription_vi,
      defaultOgImage: x.defaultOgImage,
    };
    this.publicCache = { data, cachedAt: now };
    return data;
  }
}
