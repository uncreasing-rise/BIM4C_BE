import { Injectable, NotFoundException } from '@nestjs/common';
import type { PageContent, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { UpdatePageContentDto } from './page-content.dto';
import { isPageContentKey } from './page-content.keys';

export type PublicPageContent = Record<string, { vi: unknown; en: unknown }>;

const CACHE_TTL_MS = 60_000;

@Injectable()
export class PageContentService {
  private publicCache: { data: PublicPageContent; cachedAt: number } | null =
    null;

  constructor(private readonly prisma: PrismaService) {}

  async public(): Promise<PublicPageContent> {
    const now = Date.now();
    if (this.publicCache && now - this.publicCache.cachedAt < CACHE_TTL_MS) {
      return this.publicCache.data;
    }
    const rows = await this.prisma.pageContent.findMany();
    const data = Object.fromEntries(
      rows.map((row) => [row.key, { vi: row.vi, en: row.en }]),
    );
    this.publicCache = { data, cachedAt: now };
    return data;
  }

  list(): Promise<PageContent[]> {
    return this.prisma.pageContent.findMany({ orderBy: { key: 'asc' } });
  }

  async update(key: string, dto: UpdatePageContentDto): Promise<PageContent> {
    if (!isPageContentKey(key)) {
      throw new NotFoundException(`Unknown page content block: ${key}`);
    }
    const data = {
      vi: dto.vi as Prisma.InputJsonObject,
      en: dto.en as Prisma.InputJsonObject,
    };
    const row = await this.prisma.pageContent.upsert({
      where: { key },
      update: data,
      create: { key, ...data },
    });
    this.publicCache = null;
    return row;
  }
}
