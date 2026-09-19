import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, Prisma } from '@prisma/client';
import {
  mapContent,
  type ContentResponse,
} from '../../common/dto/content-response.dto';
import {
  pageResponse,
  type PageResponse,
  type PageQueryDto,
} from '../../common/pagination/page-query.dto';
import { PrismaService } from '../../database/prisma.service';
interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}
const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 120_000; // 2 minutes

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: PageQueryDto,
  ): Promise<PageResponse<ContentResponse & { authorName: string | null }>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const sortBy = query.sortBy || 'publishedAt';
    const sortOrder = query.sortOrder || 'desc';

    const cacheKey = `list:${page}:${limit}:${query.search || ''}:${query.category || ''}:${sortBy}:${sortOrder}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) {
      return hit.data as PageResponse<ContentResponse & { authorName: string | null }>;
    }

    const where: Prisma.PostWhereInput = {
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
      ...(query.category ? { category: { slug: query.category } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.post.count({ where }),
    ]);
    const result = pageResponse(
      rows.map((row) => ({ ...mapContent(row), authorName: row.authorName })),
      total,
      page,
      limit,
    );
    cache.set(cacheKey, { data: result, cachedAt: Date.now() });
    return result;
  }

  async findBySlug(
    slug: string,
  ): Promise<ContentResponse & { authorName: string | null }> {
    const cacheKey = `slug:${slug}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) {
      return hit.data as ContentResponse & { authorName: string | null };
    }

    const row = await this.prisma.post.findFirst({
      where: { slug, status: ContentStatus.PUBLISHED, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Post not found');
    const result = { ...mapContent(row), authorName: row.authorName };
    cache.set(cacheKey, { data: result, cachedAt: Date.now() });
    return result;
  }
}

