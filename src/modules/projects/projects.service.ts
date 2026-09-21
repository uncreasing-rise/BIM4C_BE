import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, ProjectStatus } from '@prisma/client';
import {
  mapContentSummary,
  type ContentSummaryRecord,
  type ContentResponse,
} from '../../common/dto/content-response.dto';
import {
  pageResponse,
  type PageResponse,
} from '../../common/pagination/page-query.dto';
import { PrismaService } from '../../database/prisma.service';
import type { ProjectQueryDto } from './project-query.dto';

export interface ProjectResponse extends ContentResponse {
  category: { id: string; name: string; slug: string };
  location: string;
  location_vi: string | null;
  year: number | null;
  investor: string | null;
  investor_vi: string | null;
  expectedCompletion: string | null;
  expectedCompletion_vi: string | null;
  scale: string | null;
  scale_vi: string | null;
  contractPackage: string | null;
  contractPackage_vi: string | null;
  status: string;
  gallery: {
    id: string;
    url: string;
    alt: string;
    caption: string | null;
    sortOrder: number;
  }[];
}

const statusMap: Record<string, ProjectStatus> = {
  profiled: ProjectStatus.PROFILED,
  planned: ProjectStatus.PLANNED,
  in_progress: ProjectStatus.IN_PROGRESS,
  completed: ProjectStatus.COMPLETED,
};

const publicStatus = (status: ProjectStatus): string => status.toLowerCase();

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}
const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 120_000; // 2 minutes

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private map(
    row: ContentSummaryRecord & {
      category: { id: string; name: string; slug: string };
      location: string;
      location_vi: string | null;
      year: number | null;
      investor: string | null;
      investor_vi: string | null;
      expectedCompletion: string | null;
      expectedCompletion_vi: string | null;
      scale: string | null;
      scale_vi: string | null;
      contractPackage: string | null;
      contractPackage_vi: string | null;
      status: ProjectStatus;
      images: ProjectResponse['gallery'];
    },
  ): ProjectResponse {
    return {
      ...mapContentSummary(row),
      category: row.category,
      location: row.location,
      location_vi: row.location_vi,
      year: row.year,
      investor: row.investor,
      investor_vi: row.investor_vi,
      expectedCompletion: row.expectedCompletion,
      expectedCompletion_vi: row.expectedCompletion_vi,
      scale: row.scale,
      scale_vi: row.scale_vi,
      contractPackage: row.contractPackage,
      contractPackage_vi: row.contractPackage_vi,
      status: publicStatus(row.status),
      gallery: row.images,
    };
  }

  async findAll(
    query: ProjectQueryDto,
  ): Promise<PageResponse<ProjectResponse>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const sortBy = query.sortBy || 'publishedAt';
    const sortOrder = query.sortOrder || 'desc';

    const cacheKey = `list:${page}:${limit}:${query.search || ''}:${query.category || ''}:${query.status || ''}:${query.location || ''}:${query.year || ''}:${sortBy}:${sortOrder}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) {
      return hit.data as PageResponse<ProjectResponse>;
    }

    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
      status:
        query.status && statusMap[query.status]
          ? statusMap[query.status]
          : {
              in: [
                ProjectStatus.PROFILED,
                ProjectStatus.PLANNED,
                ProjectStatus.IN_PROGRESS,
                ProjectStatus.COMPLETED,
              ],
            },
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
      ...(query.location
        ? {
            AND: [
              {
                OR: [
                  { location: { contains: query.location, mode: 'insensitive' } },
                  { location_vi: { contains: query.location, mode: 'insensitive' } },
                ],
              },
            ],
          }
        : {}),
      ...(query.year ? { year: query.year } : {}),
    };

    const queryStartedAt = Date.now();
    const [rows, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        select: {
          id: true, slug: true, title: true, title_vi: true, description: true, description_vi: true,
          image: true, eyebrow: true, eyebrow_vi: true, meta: true, meta_vi: true,
          seoTitle: true, seoTitle_vi: true, seoDescription: true, seoDescription_vi: true,
          seoImage: true, canonicalUrl: true, status: true, publishedAt: true, createdAt: true, updatedAt: true,
          location: true, location_vi: true, year: true, investor: true, investor_vi: true,
          expectedCompletion: true, expectedCompletion_vi: true, scale: true, scale_vi: true,
          contractPackage: true, contractPackage_vi: true,
          category: { select: { id: true, name: true, slug: true } },
          images: { orderBy: { sortOrder: 'asc' } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.project.count({ where }),
    ]);
    this.logger.log(JSON.stringify({
      event: 'catalog.pagination.query', resource: 'projects', page, limit, total,
      durationMs: Date.now() - queryStartedAt, searchPresent: Boolean(query.search),
      category: query.category || null, status: query.status || null,
    }));

    const result = pageResponse(
      rows.map((row) => this.map(row)),
      total,
      page,
      limit,
    );
    cache.set(cacheKey, { data: result, cachedAt: Date.now() });
    return result;
  }

  async findBySlug(slug: string): Promise<ProjectResponse> {
    const cacheKey = `slug:${slug}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) {
      return hit.data as ProjectResponse;
    }

    const row = await this.prisma.project.findFirst({
      where: {
        slug,
        deletedAt: null,
        status: {
          in: [
            ProjectStatus.PROFILED,
            ProjectStatus.PLANNED,
            ProjectStatus.IN_PROGRESS,
            ProjectStatus.COMPLETED,
          ],
        },
      },
      include: { category: true, images: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!row) throw new NotFoundException('Project not found');

    const result = this.map(row);
    cache.set(cacheKey, { data: result, cachedAt: Date.now() });
    return result;
  }
}
