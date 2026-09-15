import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, Course, Prisma } from '@prisma/client';
import {
  mapContent,
} from '../../common/dto/content-response.dto';
import { PrismaService } from '../../database/prisma.service';
import { pageResponse, type PageQueryDto, type PageResponse } from '../../common/pagination/page-query.dto';
@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(query: PageQueryDto): Promise<PageResponse<unknown>> {
    const where: Prisma.CourseWhereInput = { status: ContentStatus.PUBLISHED, deletedAt: null, ...(query.search ? { OR: [{ title: { contains: query.search, mode: 'insensitive' } }, { title_vi: { contains: query.search, mode: 'insensitive' } }, { description: { contains: query.search, mode: 'insensitive' } }, { description_vi: { contains: query.search, mode: 'insensitive' } }] } : {}) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({ where, include: { curriculum: { orderBy: { sortOrder: 'asc' } } }, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }] }),
      this.prisma.course.count({ where }),
    ]);
    return pageResponse(rows.map((row) => ({ ...this.mapCourse(row), curriculum: row.curriculum })), total, query.page, query.limit);
  }
  async findBySlug(
    slug: string,
  ): Promise<unknown> {
    const row = await this.prisma.course.findFirst({
      where: { slug, status: ContentStatus.PUBLISHED, deletedAt: null },
      include: { curriculum: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!row) throw new NotFoundException('Course not found');
    return { ...this.mapCourse(row), curriculum: row.curriculum };
  }
  private mapCourse(row: Course) {
    return { ...mapContent(row), duration: row.duration, duration_vi: row.duration_vi, level: row.level, level_vi: row.level_vi, price: row.price, price_vi: row.price_vi, instructor: row.instructor, instructor_vi: row.instructor_vi, learningOutcomes: Array.isArray(row.learningOutcomes) ? row.learningOutcomes : [], learningOutcomes_vi: Array.isArray(row.learningOutcomes_vi) ? row.learningOutcomes_vi : [] };
  }
}
