import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProjectStatus } from '@prisma/client';
import { mapContent, type ContentResponse } from '../../common/dto/content-response.dto';
import { pageResponse, type PageResponse } from '../../common/pagination/page-query.dto';
import { PrismaService } from '../../database/prisma.service';
import type { ProjectQueryDto } from './project-query.dto';
export interface ProjectResponse extends ContentResponse { category: { id: string; name: string; slug: string }; location: string; year: number; status: string; gallery: { id: string; url: string; alt: string; caption: string | null; sortOrder: number }[] }
const statusMap: Record<string, ProjectStatus> = { planned: ProjectStatus.PLANNED, in_progress: ProjectStatus.IN_PROGRESS, completed: ProjectStatus.COMPLETED };
const publicStatus = (status: ProjectStatus): string => status.toLowerCase();
@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}
  private map(row: Prisma.ProjectGetPayload<{ include: { category: true; images: true } }>): ProjectResponse { return { ...mapContent(row), category: row.category, location: row.location, year: row.year, status: publicStatus(row.status), gallery: row.images }; }
  async findAll(query: ProjectQueryDto): Promise<PageResponse<ProjectResponse>> {
    const where: Prisma.ProjectWhereInput = { deletedAt: null, status: query.status ? statusMap[query.status] : { in: [ProjectStatus.PLANNED, ProjectStatus.IN_PROGRESS, ProjectStatus.COMPLETED] }, ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}), ...(query.category ? { category: { slug: query.category } } : {}), ...(query.location ? { location: { contains: query.location, mode: 'insensitive' } } : {}), ...(query.year ? { year: query.year } : {}) };
    const [rows, total] = await this.prisma.$transaction([this.prisma.project.findMany({ where, include: { category: true, images: { orderBy: { sortOrder: 'asc' } } }, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { [query.sortBy]: query.sortOrder } }), this.prisma.project.count({ where })]);
    return pageResponse(rows.map((row) => this.map(row)), total, query.page, query.limit);
  }
  async findBySlug(slug: string): Promise<ProjectResponse> { const row = await this.prisma.project.findFirst({ where: { slug, deletedAt: null, status: { in: [ProjectStatus.PLANNED, ProjectStatus.IN_PROGRESS, ProjectStatus.COMPLETED] } }, include: { category: true, images: { orderBy: { sortOrder: 'asc' } } } }); if (!row) throw new NotFoundException('Project not found'); return this.map(row); }
}
