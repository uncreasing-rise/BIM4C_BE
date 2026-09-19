import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type {
  CreateHeroSlideDto,
  CreatePartnerDto,
  UpdateHeroSlideDto,
  UpdatePartnerDto,
} from './homepage.dto';
interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}
const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 30_000;

@Injectable()
export class HomepageService {
  constructor(private readonly prisma: PrismaService) {}

  async slides(admin = false) {
    if (!admin) {
      const hit = cache.get('slides:public');
      if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) {
        return hit.data;
      }
    }
    const data = await this.prisma.heroSlide.findMany({
      where: admin ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    if (!admin) {
      cache.set('slides:public', { data, cachedAt: Date.now() });
    }
    return data;
  }

  async partners(admin = false) {
    if (!admin) {
      const hit = cache.get('partners:public');
      if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) {
        return hit.data;
      }
    }
    const data = await this.prisma.strategicPartner.findMany({
      where: admin ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    if (!admin) {
      cache.set('partners:public', { data, cachedAt: Date.now() });
    }
    return data;
  }

  async createSlide(data: CreateHeroSlideDto) {
    cache.delete('slides:public');
    return this.prisma.heroSlide.create({ data });
  }

  async createPartner(data: CreatePartnerDto) {
    cache.delete('partners:public');
    return this.prisma.strategicPartner.create({ data });
  }

  async updateSlide(id: string, data: UpdateHeroSlideDto) {
    await this.requireSlide(id);
    cache.delete('slides:public');
    return this.prisma.heroSlide.update({ where: { id }, data });
  }

  async updatePartner(id: string, data: UpdatePartnerDto) {
    await this.requirePartner(id);
    cache.delete('partners:public');
    return this.prisma.strategicPartner.update({ where: { id }, data });
  }

  async deleteSlide(id: string) {
    await this.requireSlide(id);
    cache.delete('slides:public');
    await this.prisma.heroSlide.delete({ where: { id } });
  }

  async deletePartner(id: string) {
    await this.requirePartner(id);
    cache.delete('partners:public');
    await this.prisma.strategicPartner.delete({ where: { id } });
  }
  private async requireSlide(id: string) {
    if (
      !(await this.prisma.heroSlide.findUnique({
        where: { id },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Slide not found');
  }
  private async requirePartner(id: string) {
    if (
      !(await this.prisma.strategicPartner.findUnique({
        where: { id },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Partner not found');
  }
}
