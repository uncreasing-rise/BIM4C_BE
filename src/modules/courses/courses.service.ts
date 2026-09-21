import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ContentStatus, Course, Prisma } from '@prisma/client';
import {
  mapContent,
  mapContentSummary,
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
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PageQueryDto): Promise<PageResponse<unknown>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));

    const cacheKey = `list:${page}:${limit}:${query.search || ''}:${query.category || ''}:${query.sortBy || ''}:${query.sortOrder || ''}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) {
      return hit.data as PageResponse<unknown>;
    }

    const where: Prisma.CourseWhereInput = {
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
      this.prisma.course.findMany({
        where,
        select: {
          id: true, slug: true, title: true, title_vi: true, description: true, description_vi: true,
          image: true, eyebrow: true, eyebrow_vi: true, meta: true, meta_vi: true,
          seoTitle: true, seoTitle_vi: true, seoDescription: true, seoDescription_vi: true,
          seoImage: true, canonicalUrl: true, status: true, publishedAt: true, createdAt: true, updatedAt: true,
          duration: true, duration_vi: true, level: true, level_vi: true, price: true, price_vi: true,
          instructor: true, instructor_vi: true, learningOutcomes: true, learningOutcomes_vi: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
      }),
      this.prisma.course.count({ where }),
    ]);
    this.logger.log(JSON.stringify({
      event: 'catalog.pagination.query', resource: 'courses', page, limit, total,
      durationMs: Date.now() - queryStartedAt, searchPresent: Boolean(query.search),
    }));
    const result = pageResponse(
      rows.map((row) => this.mapCourseSummary(row as Course)),
      total,
      page,
      limit,
    );
    cache.set(cacheKey, { data: result, cachedAt: Date.now() });
    return result;
  }

  async findBySlug(slug: string): Promise<unknown> {
    const cacheKey = `slug:${slug}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) {
      return hit.data;
    }

    const row = await this.prisma.course.findFirst({
      where: { slug, status: ContentStatus.PUBLISHED, deletedAt: null },
      include: { curriculum: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!row) throw new NotFoundException('Course not found');
    const result = { ...this.mapCourse(row), curriculum: row.curriculum };
    cache.set(cacheKey, { data: result, cachedAt: Date.now() });
    return result;
  }

  private mapCourse(row: Course) {
    return {
      ...mapContent(row),
      duration: row.duration,
      duration_vi: row.duration_vi,
      level: row.level,
      level_vi: row.level_vi,
      price: row.price,
      price_vi: row.price_vi,
      instructor: row.instructor,
      instructor_vi: row.instructor_vi,
      learningOutcomes: Array.isArray(row.learningOutcomes) ? row.learningOutcomes : [],
      learningOutcomes_vi: Array.isArray(row.learningOutcomes_vi) ? row.learningOutcomes_vi : [],
    };
  }

  private mapCourseSummary(row: Course) {
    return {
      ...mapContentSummary(row),
      duration: row.duration,
      duration_vi: row.duration_vi,
      level: row.level,
      level_vi: row.level_vi,
      price: row.price,
      price_vi: row.price_vi,
      instructor: row.instructor,
      instructor_vi: row.instructor_vi,
      learningOutcomes: Array.isArray(row.learningOutcomes) ? row.learningOutcomes : [],
      learningOutcomes_vi: Array.isArray(row.learningOutcomes_vi) ? row.learningOutcomes_vi : [],
    };
  }
}

