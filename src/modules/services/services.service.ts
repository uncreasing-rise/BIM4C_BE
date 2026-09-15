import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, Prisma } from '@prisma/client';
import {
  mapContent,
  type ContentResponse,
} from '../../common/dto/content-response.dto';
import { PrismaService } from '../../database/prisma.service';
import { pageResponse, type PageQueryDto, type PageResponse } from '../../common/pagination/page-query.dto';
@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(query: PageQueryDto): Promise<PageResponse<ContentResponse>> {
    const where: Prisma.ServiceWhereInput = { status: ContentStatus.PUBLISHED, deletedAt: null, ...(query.search ? { OR: [{ title: { contains: query.search, mode: 'insensitive' } }, { title_vi: { contains: query.search, mode: 'insensitive' } }, { description: { contains: query.search, mode: 'insensitive' } }, { description_vi: { contains: query.search, mode: 'insensitive' } }] } : {}) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.service.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }] }),
      this.prisma.service.count({ where }),
    ]);
    return pageResponse(rows.map(mapContent), total, query.page, query.limit);
  }
  async findBySlug(slug: string): Promise<ContentResponse> {
    const row = await this.prisma.service.findFirst({
      where: { slug, status: ContentStatus.PUBLISHED, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Service not found');
    return mapContent(row);
  }
}
