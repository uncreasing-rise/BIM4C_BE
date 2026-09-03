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
@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(query: PageQueryDto): Promise<PageResponse<ContentResponse & { authorName: string | null }>> {
    const where: Prisma.PostWhereInput = {
      status: ContentStatus.PUBLISHED,
      deletedAt: null,
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.category ? { category: { slug: query.category } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
      }),
      this.prisma.post.count({ where }),
    ]);
    return pageResponse(rows.map((row) => ({ ...mapContent(row), authorName: row.authorName })), total, query.page, query.limit);
  }
  async findBySlug(slug: string): Promise<ContentResponse & { authorName: string | null }> {
    const row = await this.prisma.post.findFirst({
      where: { slug, status: ContentStatus.PUBLISHED, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Post not found');
    return { ...mapContent(row), authorName: row.authorName };
  }
}
