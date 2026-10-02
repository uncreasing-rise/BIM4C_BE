import { Injectable, NotFoundException } from '@nestjs/common';
import type { PageContent, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { UpdatePageContentDto } from './page-content.dto';
import { isPageContentKey } from './page-content.keys';

export type PublicPageContent = Record<string, { vi: unknown; en: unknown }>;

const CACHE_TTL_MS = 60_000;

/**
 * The team on the About page is shown by role and expertise only: names and
 * photos stay in the database (admins still edit them) but never leave the
 * API publicly, so they are in no page's source either.
 */
export function withoutTeamIdentity(key: string, value: unknown): unknown {
  if (key !== 'about' || !value || typeof value !== 'object') return value;
  const about = value as { teamMembers?: unknown };
  if (!Array.isArray(about.teamMembers)) return value;
  return {
    ...about,
    teamMembers: about.teamMembers.map((member: unknown) => {
      if (!member || typeof member !== 'object') return member;
      const {
        name: _name,
        image: _image,
        ...rest
      } = member as Record<string, unknown>;
      void _name;
      void _image;
      return rest;
    }),
  };
}

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
      rows.map((row) => [
        row.key,
        {
          vi: withoutTeamIdentity(row.key, row.vi),
          en: withoutTeamIdentity(row.key, row.en),
        },
      ]),
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
