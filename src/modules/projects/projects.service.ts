import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProjectStatus } from '@prisma/client';
import {
  mapContent,
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
@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}
  private map(
    row: Prisma.ProjectGetPayload<{
      include: { category: true; images: true };
    }>,
  ): ProjectResponse {
    return {
      ...mapContent(row),
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
    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
      status: query.status
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
        ? { OR: [{ title: { contains: query.search, mode: 'insensitive' } }, { title_vi: { contains: query.search, mode: 'insensitive' } }, { description: { contains: query.search, mode: 'insensitive' } }, { description_vi: { contains: query.search, mode: 'insensitive' } }] }
        : {}),
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.location
        ? { AND: [{ OR: [{ location: { contains: query.location, mode: 'insensitive' } }, { location_vi: { contains: query.location, mode: 'insensitive' } }] }] }
        : {}),
      ...(query.year ? { year: query.year } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        include: { category: true, images: { orderBy: { sortOrder: 'asc' } } },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
      }),
      this.prisma.project.count({ where }),
    ]);
    return pageResponse(
      rows.map((row) => this.map(row)),
      total,
      query.page,
      query.limit,
    );
  }
  async findBySlug(slug: string): Promise<ProjectResponse> {
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
    return this.map(row);
  }
}
