import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ContentStatus, Prisma } from '@prisma/client';
import {
  mapContent,
  mapContentSummary,
  type ContentResponse,
} from '../../common/dto/content-response.dto';
import { PrismaService } from '../../database/prisma.service';
import { pageResponse, type PageQueryDto, type PageResponse } from '../../common/pagination/page-query.dto';
interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}
const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 120_000; // 2 minutes

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PageQueryDto): Promise<PageResponse<ContentResponse>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));

    const cacheKey = `list:${page}:${limit}:${query.search || ''}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) {
      this.logger.debug(JSON.stringify({ event: 'catalog.pagination.cache_hit', resource: 'services', page, limit }));
      return hit.data as PageResponse<ContentResponse>;
    }

    const where: Prisma.ServiceWhereInput = {
      status: ContentStatus.PUBLISHED,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { title_vi: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { description_vi: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const queryStartedAt = Date.now();
    const [rows, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        select: {
          id: true, slug: true, title: true, title_vi: true, description: true, description_vi: true,
          image: true, eyebrow: true, eyebrow_vi: true, meta: true, meta_vi: true,
          seoTitle: true, seoTitle_vi: true, seoDescription: true, seoDescription_vi: true,
          seoImage: true, canonicalUrl: true, status: true, publishedAt: true, createdAt: true, updatedAt: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
      }),
      this.prisma.service.count({ where }),
    ]);
    this.logger.log(JSON.stringify({
      event: 'catalog.pagination.query', resource: 'services', page, limit, total,
      durationMs: Date.now() - queryStartedAt, searchPresent: Boolean(query.search),
    }));
    const result = pageResponse(rows.map(mapContentSummary), total, page, limit);
    cache.set(cacheKey, { data: result, cachedAt: Date.now() });
    return result;
  }

  async findBySlug(slug: string): Promise<ContentResponse> {
    const cacheKey = `slug:${slug}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) {
      return hit.data as ContentResponse;
    }

    const row = await this.prisma.service.findFirst({
      where: { slug, status: ContentStatus.PUBLISHED, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Service not found');
    const result = mapContent(row);
    cache.set(cacheKey, { data: result, cachedAt: Date.now() });
    return result;
  }
}

