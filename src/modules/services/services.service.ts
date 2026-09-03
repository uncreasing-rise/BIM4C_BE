import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import {
  mapContent,
  type ContentResponse,
} from '../../common/dto/content-response.dto';
import { PrismaService } from '../../database/prisma.service';
@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(): Promise<ContentResponse[]> {
    return (
      await this.prisma.service.findMany({
        where: { status: ContentStatus.PUBLISHED, deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
      })
    ).map(mapContent);
  }
  async findBySlug(slug: string): Promise<ContentResponse> {
    const row = await this.prisma.service.findFirst({
      where: { slug, status: ContentStatus.PUBLISHED, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Service not found');
    return mapContent(row);
  }
}
