import { Injectable, NotFoundException } from '@nestjs/common'; import { ContentStatus } from '@prisma/client';
import { mapContent, type ContentResponse } from '../../common/dto/content-response.dto'; import { PrismaService } from '../../database/prisma.service';
@Injectable() export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(): Promise<(ContentResponse & { curriculum: unknown[] })[]> { return (await this.prisma.course.findMany({ where: { status: ContentStatus.PUBLISHED, deletedAt: null }, include: { curriculum: { orderBy: { sortOrder: 'asc' } } }, orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }] })).map(row => ({ ...mapContent(row), curriculum: row.curriculum })); }
  async findBySlug(slug: string): Promise<ContentResponse & { curriculum: unknown[] }> { const row = await this.prisma.course.findFirst({ where: { slug, status: ContentStatus.PUBLISHED, deletedAt: null }, include: { curriculum: { orderBy: { sortOrder: 'asc' } } } }); if (!row) throw new NotFoundException('Course not found'); return { ...mapContent(row), curriculum: row.curriculum }; }
}
