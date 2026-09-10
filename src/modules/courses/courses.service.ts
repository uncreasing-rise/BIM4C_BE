import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, Prisma } from '@prisma/client';
import {
  mapContent,
} from '../../common/dto/content-response.dto';
import { PrismaService } from '../../database/prisma.service';
import { pageResponse, type PageQueryDto, type PageResponse } from '../../common/pagination/page-query.dto';
@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(query: PageQueryDto): Promise<PageResponse<unknown>> {
    const where: Prisma.CourseWhereInput = { status: ContentStatus.PUBLISHED, deletedAt: null, ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}), ...(query.category ? { category: { slug: query.category } } : {}) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({ where, include: { curriculum: { orderBy: { sortOrder: 'asc' } } }, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }] }),
      this.prisma.course.count({ where }),
    ]);
    return pageResponse(rows.map((row) => ({ ...mapContent(row), curriculum: row.curriculum, duration: row.duration, level: row.level, price: row.price, instructor: row.instructor, learningOutcomes: Array.isArray(row.learningOutcomes) ? row.learningOutcomes : [] })), total, query.page, query.limit);
  }
  async findBySlug(
    slug: string,
  ): Promise<unknown> {
    const row = await this.prisma.course.findFirst({
      where: { slug, status: ContentStatus.PUBLISHED, deletedAt: null },
      include: { curriculum: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!row) throw new NotFoundException('Course not found');
    return { ...mapContent(row), curriculum: row.curriculum, duration: row.duration, level: row.level, price: row.price, instructor: row.instructor, learningOutcomes: Array.isArray(row.learningOutcomes) ? row.learningOutcomes : [] };
  }
}
