/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  OnModuleInit,
} from '@nestjs/common';
import { ContentStatus, Prisma, ProjectStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { pageResponse } from '../../common/pagination/page-query.dto';
import type {
  BulkActionDto,
  CategoryDto,
  CourseSectionDto,
  CreateContentDto,
  CreatePostDto,
  CreateProjectDto,
  NewsletterStatusDto,
  ProjectImageDto,
  StatusDto,
  SubmissionStatusDto,
  UpdateCategoryDto,
  UpdateContentDto,
  UpdateCourseSectionDto,
  UpdateMediaDto,
  UpdatePostDto,
  UpdateProjectDto,
  UpdateProjectImageDto,
} from './admin.dto';
import { AdminListQueryDto } from './admin.dto';
import { MediaStorageService } from './media-storage.service';
import { isContentBlock } from '../../common/dto/content-response.dto';
import { clearPostsCache } from '../posts/posts.service';

type Domain = 'project' | 'service' | 'course' | 'post';
const delegateName: Record<Domain, string> = {
  project: 'project',
  service: 'service',
  course: 'course',
  post: 'post',
};
const allowedSort = new Set([
  'createdAt',
  'updatedAt',
  'publishedAt',
  'title',
  'sortOrder',
]);

interface AdminCacheEntry<T> {
  data: T;
  cachedAt: number;
}
const adminCache = new Map<string, AdminCacheEntry<unknown>>();
// Keep the warm cache alive through the admin login flow. Mutations invalidate
// the affected entries immediately, so the longer TTL does not delay updates.
const ADMIN_CACHE_TTL_MS = 300_000;

export function invalidateAdminCache(pattern?: string) {
  if (pattern) {
    for (const key of adminCache.keys()) {
      if (key.startsWith(pattern)) adminCache.delete(key);
    }
  } else {
    adminCache.clear();
  }
}

@Injectable()
export class AdminService implements OnModuleInit {
  private readonly logger = new Logger(AdminService.name);
  private dashboardCache: { data: unknown; cachedAt: number } | null = null;
  private recentCache: { data: unknown; cachedAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorageService,
  ) {}

  async onModuleInit(): Promise<void> {
    const projectQuery = new AdminListQueryDto();
    try {
      // Warm the shared database connection before warming the heavier list
      // query. Running both cold queries concurrently can make the pooler
      // reject one of them and leave the first browser request slow.
      await this.categories('project');
      await this.list('project', projectQuery);
      await this.list('service', projectQuery);
      this.logger.log('Admin content cache warm-up completed');
    } catch (error) {
      // Startup must remain available even when the optional warm-up fails.
      this.logger.warn(
        `Admin content cache warm-up skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  private delegate(domain: Domain): any {
    return (this.prisma as any)[delegateName[domain]];
  }
  private where(domain: Domain, query: AdminListQueryDto): any {
    const where: any = { deletedAt: null };
    if (query.search)
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
      ];
    if (query.status) {
      const status = query.status.toUpperCase();
      where.status =
        domain === 'project' && status === 'PUBLISHED'
          ? {
              in: [
                ProjectStatus.PROFILED,
                ProjectStatus.PLANNED,
                ProjectStatus.IN_PROGRESS,
                ProjectStatus.COMPLETED,
              ],
            }
          : status;
    }
    if (query.category && (domain === 'project' || domain === 'post'))
      where.categoryId = query.category;
    return where;
  }
  async list(domain: Domain, query: AdminListQueryDto) {
    const cacheKey = `list:${domain}:${query.page}:${query.limit}:${query.search || ''}:${query.status || ''}:${query.category || ''}:${query.sortBy || ''}:${query.sortOrder || ''}`;
    const hit = adminCache.get(cacheKey);
    if (hit && Date.now() - hit.cachedAt < ADMIN_CACHE_TTL_MS) {
      return hit.data;
    }
    const delegate = this.delegate(domain);
    const where = this.where(domain, query);
    const include =
      domain === 'project'
        ? { category: true, images: { orderBy: { sortOrder: 'asc' } } }
        : domain === 'post'
          ? { category: true }
          : domain === 'course'
            ? { curriculum: { orderBy: { sortOrder: 'asc' } } }
            : undefined;
    const sortBy = allowedSort.has(query.sortBy) ? query.sortBy : 'updatedAt';
    const [rows, total] = await Promise.all([
      delegate.findMany({
        where,
        include,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { [sortBy]: query.sortOrder },
      }),
      delegate.count({ where }),
    ]);
    const result = pageResponse(rows, total, query.page, query.limit);
    adminCache.set(cacheKey, { data: result, cachedAt: Date.now() });
    return result;
  }
  async detail(domain: Domain, id: string) {
    const include =
      domain === 'project'
        ? { category: true, images: { orderBy: { sortOrder: 'asc' } } }
        : domain === 'post'
          ? { category: true }
          : domain === 'course'
            ? { curriculum: { orderBy: { sortOrder: 'asc' } } }
            : undefined;
    const row = await this.delegate(domain).findFirst({
      where: { id, deletedAt: null },
      include,
    });
    if (!row) throw new NotFoundException(`${domain} not found`);
    return row;
  }
  private invalidateMutation(domain?: Domain) {
    this.dashboardCache = null;
    this.recentCache = null;
    if (domain) invalidateAdminCache(`list:${domain}`);
    else invalidateAdminCache();
    if (!domain || domain === 'post') clearPostsCache();
  }
  async create(
    domain: Domain,
    input: CreateContentDto | CreateProjectDto | CreatePostDto,
  ) {
    try {
      const created = await this.delegate(domain).create({
        data: this.writeData(domain, input),
      });
      this.invalidateMutation(domain);
      return created;
    } catch (error) {
      this.writeError(error);
    }
  }
  async update(
    domain: Domain,
    id: string,
    input: UpdateContentDto | UpdateProjectDto | UpdatePostDto,
  ) {
    await this.detail(domain, id);
    try {
      const updated = await this.delegate(domain).update({
        where: { id },
        data: this.writeData(domain, input),
      });
      this.invalidateMutation(domain);
      return updated;
    } catch (error) {
      this.writeError(error);
    }
  }
  private writeData(domain: Domain, input: any): any {
    const data = { ...input };
    const safeReference = (value: string) => /^\/(?!\/)/.test(value) || /^https:\/\//i.test(value) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(value);
    for (const field of ['image', 'seoImage', 'canonicalUrl']) {
      if (typeof data[field] === 'string' && data[field] && !safeReference(data[field]))
        throw new UnprocessableEntityException(`Invalid ${field}`);
    }
    if ('contentBlocks' in data && data.contentBlocks != null && (!Array.isArray(data.contentBlocks) || !data.contentBlocks.every(isContentBlock)))
      throw new UnprocessableEntityException('Invalid content blocks');
    if ('contentBlocks_vi' in data && data.contentBlocks_vi != null && (!Array.isArray(data.contentBlocks_vi) || !data.contentBlocks_vi.every(isContentBlock)))
      throw new UnprocessableEntityException('Invalid Vietnamese content blocks');
    if ('relatedIds' in data && data.relatedIds != null && (!Array.isArray(data.relatedIds) || !data.relatedIds.every((id: unknown) => typeof id === 'string')))
      throw new UnprocessableEntityException('Invalid related content IDs');
    if ('learningOutcomes' in data && data.learningOutcomes != null && (!Array.isArray(data.learningOutcomes) || !data.learningOutcomes.every((item: unknown) => typeof item === 'string')))
      throw new UnprocessableEntityException('Invalid learning outcomes');
    for (const field of ['softwareStack', 'softwareStack_vi']) {
      if (field in data && data[field] != null && (!Array.isArray(data[field]) || !data[field].every((item: unknown) => typeof item === 'string')))
        throw new UnprocessableEntityException(`Invalid ${field}`);
    }
    if ('publishedAt' in data)
      data.publishedAt = data.publishedAt ? new Date(data.publishedAt) : null;
    if (data.status === ContentStatus.PUBLISHED && !data.publishedAt)
      data.publishedAt = new Date();
    if (domain === 'project' && data.status === 'PUBLISHED')
      data.status = ProjectStatus.PROFILED;
    return data;
  }
  async remove(domain: Domain, id: string) {
    // Deletes are idempotent: a stale browser tab or a repeated request may
    // send the same DELETE after the row was already soft-deleted. Treat that
    // as success so the client can finish its optimistic update and refetch.
    await this.delegate(domain).updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    this.invalidateMutation(domain);
  }
  async status(domain: Domain, id: string, input: StatusDto) {
    await this.detail(domain, id);
    const value = input.status.toUpperCase();
    const allowed =
      domain === 'project'
        ? Object.values(ProjectStatus)
        : Object.values(ContentStatus);
    if (!allowed.includes(value as never))
      throw new UnprocessableEntityException('Invalid status');
    return this.delegate(domain).update({
      where: { id },
      data: {
        status: value,
        publishedAt:
          value === 'PUBLISHED' ||
          (domain === 'project' && !['DRAFT', 'ARCHIVED'].includes(value))
            ? new Date()
            : null,
      },
    });
  }
  async bulk(domain: Domain, input: BulkActionDto) {
    const delegate = this.delegate(domain);
    const existing = await delegate.findMany({
      where: { id: { in: input.ids }, deletedAt: null },
      select: { id: true },
    });
    if (existing.length !== input.ids.length)
      throw new NotFoundException('One or more records do not exist');
    const project = domain === 'project';
    const data =
      input.action === 'delete'
        ? { deletedAt: new Date() }
        : input.action === 'archive'
          ? { status: 'ARCHIVED' }
          : input.action === 'unpublish'
            ? { status: 'DRAFT', publishedAt: null }
            : {
                status: project ? 'PROFILED' : 'PUBLISHED',
                publishedAt: new Date(),
              };
    const result = await delegate.updateMany({
      where: { id: { in: input.ids } },
      data,
    });
    return { success: true, affected: result.count };
  }
  private writeError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new ConflictException('Slug already exists');
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    )
      throw new ConflictException('Referenced record does not exist');
    throw error;
  }

  categories(type: 'project' | 'post') {
    const cacheKey = `categories:${type}`;
    const hit = adminCache.get(cacheKey);
    if (hit && Date.now() - hit.cachedAt < ADMIN_CACHE_TTL_MS) {
      return hit.data;
    }
    return (this.prisma as any)[`${type}Category`]
      .findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true },
      })
      .then((data: unknown) => {
        adminCache.set(cacheKey, { data, cachedAt: Date.now() });
        return data;
      });
  }
  async createCategory(type: 'project' | 'post', input: CategoryDto) {
    try {
      const created = await (this.prisma as any)[`${type}Category`].create({
        data: input,
      });
      this.invalidateMutation(type === 'project' ? 'project' : 'post');
      adminCache.delete(`categories:${type}`);
      return created;
    } catch (e) {
      this.writeError(e);
    }
  }
  async updateCategory(
    type: 'project' | 'post',
    id: string,
    input: UpdateCategoryDto,
  ) {
    try {
      const updated = await (this.prisma as any)[`${type}Category`].update({
        where: { id },
        data: input,
      });
      this.invalidateMutation(type === 'project' ? 'project' : 'post');
      adminCache.delete(`categories:${type}`);
      return updated;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      )
        throw new NotFoundException('Category not found');
      this.writeError(e);
    }
  }
  async deleteCategory(type: 'project' | 'post', id: string) {
    const relation = type === 'project' ? 'project' : 'post';
    const used = await (this.prisma as any)[relation].count({
      where: { categoryId: id, deletedAt: null },
    });
    if (used) throw new ConflictException('Category is in use');
    try {
      await (this.prisma as any)[`${type}Category`].delete({ where: { id } });
      this.invalidateMutation(type === 'project' ? 'project' : 'post');
      adminCache.delete(`categories:${type}`);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      )
        throw new NotFoundException('Category not found');
      throw e;
    }
  }

  async images(projectId: string) {
    await this.detail('project', projectId);
    return this.prisma.projectImage.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    });
  }
  async addImage(projectId: string, input: ProjectImageDto) {
    await this.detail('project', projectId);
    return this.prisma.projectImage.create({ data: { ...input, projectId } });
  }
  async updateImage(
    projectId: string,
    id: string,
    input: UpdateProjectImageDto,
  ) {
    const row = await this.prisma.projectImage.findFirst({
      where: { id, projectId },
    });
    if (!row) throw new NotFoundException('Image not found');
    return this.prisma.projectImage.update({ where: { id }, data: input });
  }
  async deleteImage(projectId: string, id: string) {
    const row = await this.prisma.projectImage.findFirst({
      where: { id, projectId },
    });
    if (!row) throw new NotFoundException('Image not found');
    await this.prisma.projectImage.delete({ where: { id } });
  }
  async curriculum(courseId: string) {
    await this.detail('course', courseId);
    return this.prisma.courseSection.findMany({
      where: { courseId },
      orderBy: { sortOrder: 'asc' },
    });
  }
  async addSection(courseId: string, input: CourseSectionDto) {
    await this.detail('course', courseId);
    return this.prisma.courseSection.create({ data: { ...input, courseId } });
  }
  async updateSection(
    courseId: string,
    id: string,
    input: UpdateCourseSectionDto,
  ) {
    const row = await this.prisma.courseSection.findFirst({
      where: { id, courseId },
    });
    if (!row) throw new NotFoundException('Section not found');
    return this.prisma.courseSection.update({ where: { id }, data: input });
  }
  async deleteSection(courseId: string, id: string) {
    const row = await this.prisma.courseSection.findFirst({
      where: { id, courseId },
    });
    if (!row) throw new NotFoundException('Section not found');
    await this.prisma.courseSection.delete({ where: { id } });
  }

  private dateWhere(query: AdminListQueryDto): any {
    return query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        }
      : {};
  }
  async contacts(query: AdminListQueryDto) {
    const cacheKey = `contacts:${query.page}:${query.limit}:${query.search || ''}:${query.status || ''}:${query.from || ''}:${query.to || ''}:${query.sortOrder || ''}`;
    const hit = adminCache.get(cacheKey);
    if (hit && Date.now() - hit.cachedAt < ADMIN_CACHE_TTL_MS) {
      return hit.data;
    }
    const where: any = {
      ...this.dateWhere(query),
      ...(query.status ? { status: query.status.toUpperCase() } : {}),
      ...(query.search
        ? {
            OR: ['name', 'email', 'company'].map((field) => ({
              [field]: { contains: query.search, mode: 'insensitive' },
            })),
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: query.sortOrder },
      }),
      this.prisma.contact.count({ where }),
    ]);
    const result = pageResponse(data, total, query.page, query.limit);
    adminCache.set(cacheKey, { data: result, cachedAt: Date.now() });
    return result;
  }
  async contact(id: string) {
    const row = await this.prisma.contact.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Contact not found');
    return row;
  }
  async updateContact(id: string, input: SubmissionStatusDto) {
    await this.contact(id);
    const res = await this.prisma.contact.update({ where: { id }, data: input });
    invalidateAdminCache('contacts');
    this.dashboardCache = null;
    return res;
  }
  async deleteContact(id: string) {
    await this.contact(id);
    await this.prisma.contact.delete({ where: { id } });
    invalidateAdminCache('contacts');
    this.dashboardCache = null;
  }
  async registrations(query: AdminListQueryDto) {
    const cacheKey = `registrations:${query.page}:${query.limit}:${query.search || ''}:${query.status || ''}:${query.course || ''}:${query.from || ''}:${query.to || ''}:${query.sortOrder || ''}`;
    const hit = adminCache.get(cacheKey);
    if (hit && Date.now() - hit.cachedAt < ADMIN_CACHE_TTL_MS) {
      return hit.data;
    }
    const where: any = {
      ...this.dateWhere(query),
      ...(query.course ? { courseId: query.course } : {}),
      ...(query.status ? { status: query.status.toUpperCase() } : {}),
      ...(query.search
        ? {
            OR: ['name', 'email', 'phone'].map((field) => ({
              [field]: { contains: query.search, mode: 'insensitive' },
            })),
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.courseRegistration.findMany({
        where,
        include: { course: { select: { id: true, title: true, slug: true } } },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: query.sortOrder },
      }),
      this.prisma.courseRegistration.count({ where }),
    ]);
    const result = pageResponse(data, total, query.page, query.limit);
    adminCache.set(cacheKey, { data: result, cachedAt: Date.now() });
    return result;
  }
  async registration(id: string) {
    const row = await this.prisma.courseRegistration.findUnique({
      where: { id },
      include: { course: { select: { id: true, title: true, slug: true } } },
    });
    if (!row) throw new NotFoundException('Registration not found');
    return row;
  }
  async updateRegistration(id: string, input: SubmissionStatusDto) {
    await this.registration(id);
    const res = await this.prisma.courseRegistration.update({
      where: { id },
      data: input,
    });
    invalidateAdminCache('registrations');
    this.dashboardCache = null;
    return res;
  }
  async deleteRegistration(id: string) {
    await this.registration(id);
    await this.prisma.courseRegistration.delete({ where: { id } });
    invalidateAdminCache('registrations');
    this.dashboardCache = null;
  }
  async subscriptions(query: AdminListQueryDto) {
    const cacheKey = `subscriptions:${query.page}:${query.limit}:${query.search || ''}:${query.status || ''}:${query.sortOrder || ''}`;
    const hit = adminCache.get(cacheKey);
    if (hit && Date.now() - hit.cachedAt < ADMIN_CACHE_TTL_MS) {
      return hit.data;
    }
    const where: any = {
      ...this.dateWhere(query),
      ...(query.status ? { isActive: query.status === 'active' } : {}),
      ...(query.search
        ? { email: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.newsletterSubscription.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: query.sortOrder },
      }),
      this.prisma.newsletterSubscription.count({ where }),
    ]);
    const result = pageResponse(data, total, query.page, query.limit);
    adminCache.set(cacheKey, { data: result, cachedAt: Date.now() });
    return result;
  }
  async subscription(id: string) {
    const row = await this.prisma.newsletterSubscription.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Subscription not found');
    return row;
  }
  async updateSubscription(id: string, input: NewsletterStatusDto) {
    await this.subscription(id);
    const res = await this.prisma.newsletterSubscription.update({
      where: { id },
      data: {
        isActive: input.isActive,
        consent: input.isActive,
        unsubscribedAt: input.isActive ? null : new Date(),
      },
    });
    invalidateAdminCache('subscriptions');
    this.dashboardCache = null;
    return res;
  }
  async deleteSubscription(id: string) {
    await this.subscription(id);
    await this.prisma.newsletterSubscription.delete({ where: { id } });
    invalidateAdminCache('subscriptions');
    this.dashboardCache = null;
  }
  private csv(rows: unknown[][]) {
    const cell = (value: unknown) => {
      const text =
        value === null || value === undefined
          ? ''
          : typeof value === 'string'
            ? value
            : typeof value === 'number' ||
                typeof value === 'boolean' ||
                typeof value === 'bigint'
              ? value.toString()
              : typeof value === 'object'
                ? JSON.stringify(value)
                : '';
      return `"${text.replaceAll('"', '""')}"`;
    };
    return `\uFEFF${rows.map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`;
  }
  async exportContacts(query: AdminListQueryDto) {
    const where: Prisma.ContactWhereInput = {
      ...this.dateWhere(query),
      ...(query.status ? { status: query.status.toUpperCase() as never } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { company: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.contact.findMany({
      where,
      orderBy: { createdAt: query.sortOrder },
    });
    return this.csv([
      ['Name', 'Email', 'Phone', 'Company', 'Message', 'Status', 'Created At'],
      ...rows.map((x) => [
        x.name,
        x.email,
        x.phone,
        x.company,
        x.message,
        x.status,
        x.createdAt.toISOString(),
      ]),
    ]);
  }
  async exportRegistrations(query: AdminListQueryDto) {
    const where: Prisma.CourseRegistrationWhereInput = {
      ...this.dateWhere(query),
      ...(query.course ? { courseId: query.course } : {}),
      ...(query.status ? { status: query.status.toUpperCase() as never } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.courseRegistration.findMany({
      where,
      include: { course: { select: { title: true } } },
      orderBy: { createdAt: query.sortOrder },
    });
    return this.csv([
      ['Course', 'Name', 'Email', 'Phone', 'Status', 'Created At'],
      ...rows.map((x) => [
        x.course.title,
        x.name,
        x.email,
        x.phone,
        x.status,
        x.createdAt.toISOString(),
      ]),
    ]);
  }
  async exportSubscriptions(query: AdminListQueryDto) {
    const where: Prisma.NewsletterSubscriptionWhereInput = {
      ...this.dateWhere(query),
      ...(query.status ? { isActive: query.status === 'active' } : {}),
      ...(query.search
        ? { email: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const rows = await this.prisma.newsletterSubscription.findMany({
      where,
      orderBy: { createdAt: query.sortOrder },
    });
    return this.csv([
      ['Email', 'Active', 'Subscribed At', 'Unsubscribed At'],
      ...rows.map((x) => [
        x.email,
        x.isActive,
        x.createdAt.toISOString(),
        x.unsubscribedAt?.toISOString(),
      ]),
    ]);
  }

  async dashboard() {
    const now = Date.now();
    if (this.dashboardCache && now - this.dashboardCache.cachedAt < 15_000) {
      return this.dashboardCache.data;
    }
    const [
      projects,
      services,
      courses,
      posts,
      contacts,
      registrations,
      newsletter,
    ] = await Promise.all([
      this.countStatuses('project'),
      this.countStatuses('service'),
      this.countStatuses('course'),
      this.countStatuses('post'),
      this.prisma.contact.groupBy({ by: ['status'], _count: true }),
      this.prisma.courseRegistration.groupBy({ by: ['status'], _count: true }),
      this.prisma.newsletterSubscription.groupBy({
        by: ['isActive'],
        _count: true,
      }),
    ]);
    const data = {
      projects,
      services,
      courses,
      posts,
      contacts,
      registrations,
      newsletter,
    };
    this.dashboardCache = { data, cachedAt: now };
    return data;
  }
  private async countStatuses(domain: Domain) {
    const rows = await this.delegate(domain).groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: true,
    });
    return {
      total: rows.reduce((n: number, x: any) => n + x._count, 0),
      byStatus: Object.fromEntries(
        rows.map((x: any) => [x.status.toLowerCase(), x._count]),
      ),
    };
  }
  async recent() {
    const now = Date.now();
    if (this.recentCache && now - this.recentCache.cachedAt < 15_000) {
      return this.recentCache.data;
    }
    const domains: Domain[] = ['project', 'service', 'course', 'post'];
    const rows = await Promise.all(
      domains.map(async (domain) =>
        (
          await this.delegate(domain).findMany({
            where: { deletedAt: null },
            take: 5,
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              slug: true,
              title: true,
              image: true,
              status: true,
              updatedAt: true,
            },
          })
        ).map((x: any) => ({ ...x, type: domain })),
      ),
    );
    const data = rows
      .flat()
      .sort(
        (a: any, b: any) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
      .slice(0, 10);
    this.recentCache = { data, cachedAt: now };
    return data;
  }
  async media(query: AdminListQueryDto) {
    const cacheKey = `media:${query.page}:${query.limit}:${query.search || ''}:${query.sortOrder || ''}`;
    const hit = adminCache.get(cacheKey);
    if (hit && Date.now() - hit.cachedAt < ADMIN_CACHE_TTL_MS) {
      return hit.data;
    }
    const where = query.search
      ? {
          OR: [
            {
              filename: {
                contains: query.search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              alt: {
                contains: query.search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          ],
        }
      : {};
    const [data, total] = await Promise.all([
      this.prisma.media.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: query.sortOrder },
      }),
      this.prisma.media.count({ where }),
    ]);
    const result = pageResponse(data, total, query.page, query.limit);
    adminCache.set(cacheKey, { data: result, cachedAt: Date.now() });
    return result;
  }
  async mediaDetail(id: string) {
    const row = await this.prisma.media.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Media not found');
    return row;
  }
  async updateMedia(id: string, input: UpdateMediaDto) {
    await this.mediaDetail(id);
    const res = await this.prisma.media.update({ where: { id }, data: input });
    invalidateAdminCache('media');
    return res;
  }
  async uploadMedia(file: Express.Multer.File, alt?: string) {
    const stored = await this.storage.save(file);
    try {
      const res = await this.prisma.media.create({
        data: {
          ...stored,
          filename: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          alt: alt?.trim() || null,
        },
      });
      invalidateAdminCache('media');
      return res;
    } catch (error) {
      await this.storage.remove(stored.storageKey);
      throw error;
    }
  }
  async deleteMedia(id: string) {
    const row = await this.mediaDetail(id);
    await this.storage.remove(row.storageKey);
    await this.prisma.media.delete({ where: { id } });
    invalidateAdminCache('media');
  }
}
