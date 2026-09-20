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

export interface PostResponse extends ContentResponse {
  authorName: string | null;
  category?: { id: string; name: string; slug: string } | null;
}

export interface PostCategoryResponse {
  id: string;
  name: string;
  slug: string;
  count: number;
}

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}
const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 120_000; // 2 minutes

export function clearPostsCache(): void {
  cache.clear();
}

const NEWS_SLUGS = ['tin-tuc', 'su-kien', 'tuyen-dung', 'hop-tac', 'news', 'events', 'thong-cao'];

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: PageQueryDto & { group?: 'technical' | 'news' },
  ): Promise<PageResponse<PostResponse>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const sortBy = query.sortBy || 'publishedAt';
    const sortOrder = query.sortOrder || 'desc';
    const group = query.group;

    const cacheKey = `list:${page}:${limit}:${query.search || ''}:${query.category || ''}:${group || 'all'}:${sortBy}:${sortOrder}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) {
      return hit.data as PageResponse<PostResponse>;
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
      ...(query.category
        ? {
            category: {
              OR: [
                { slug: { equals: query.category, mode: 'insensitive' } },
                { name: { contains: query.category, mode: 'insensitive' } },
              ],
            },
          }
        : group === 'news'
          ? {
              category: {
                slug: { in: NEWS_SLUGS },
              },
            }
          : group === 'technical'
            ? {
                OR: [
                  { categoryId: null },
                  {
                    category: {
                      slug: { notIn: NEWS_SLUGS },
                    },
                  },
                ],
              }
            : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: { category: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.post.count({ where }),
    ]);
    const result = pageResponse(
      rows.map((row) => ({
        ...mapContent(row),
        authorName: row.authorName,
        category: row.category
          ? { id: row.category.id, name: row.category.name, slug: row.category.slug }
          : null,
      })),
      total,
      page,
      limit,
    );
    cache.set(cacheKey, { data: result, cachedAt: Date.now() });
    return result;
  }

  async findBySlug(slug: string): Promise<PostResponse> {
    const cacheKey = `slug:${slug}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) {
      return hit.data as PostResponse;
    }

    const row = await this.prisma.post.findFirst({
      where: { slug, status: ContentStatus.PUBLISHED, deletedAt: null },
      include: { category: true },
    });
    if (!row) throw new NotFoundException('Post not found');
    const result: PostResponse = {
      ...mapContent(row),
      authorName: row.authorName,
      category: row.category
        ? { id: row.category.id, name: row.category.name, slug: row.category.slug }
        : null,
    };
    cache.set(cacheKey, { data: result, cachedAt: Date.now() });
    return result;
  }

  async getCategories(group?: 'technical' | 'news'): Promise<PostCategoryResponse[]> {
    const cacheKey = `categories:${group || 'all'}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) {
      return hit.data as PostCategoryResponse[];
    }

    const whereCategory: Prisma.PostCategoryWhereInput = group === 'news'
      ? { slug: { in: NEWS_SLUGS } }
      : group === 'technical'
        ? { slug: { notIn: NEWS_SLUGS } }
        : {};

    const categories = await this.prisma.postCategory.findMany({
      where: whereCategory,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            posts: {
              where: { status: ContentStatus.PUBLISHED, deletedAt: null },
            },
          },
        },
      },
    });
    const result: PostCategoryResponse[] = categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      count: c._count.posts,
    }));
    cache.set(cacheKey, { data: result, cachedAt: Date.now() });
    return result;
  }
}


