import {
  UnprocessableEntityException,
  ValidationPipe,
  type INestApplication,
  type ValidationError,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ContentStatus, ProjectStatus } from '@prisma/client';
import request = require('supertest');
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { PrismaService } from '../src/database/prisma.service';

const courseId = '11111111-1111-4111-8111-111111111111';
const sessionCookie = {
  Cookie:
    'bim4c_admin_session=test-session-token-with-at-least-thirty-two-characters',
};
const content = {
  id: courseId,
  slug: 'valid-slug',
  title: 'Valid title',
  description: 'Valid description',
  image: '/images/hero.jpg',
  eyebrow: 'BIM4C',
  meta: null,
  highlights: ['Quality'],
  sections: [{ title: 'Overview', body: 'Content' }],
  status: ContentStatus.PUBLISHED,
  sortOrder: 0,
  publishedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};
const project = {
  ...content,
  status: ProjectStatus.COMPLETED,
  location: 'Ha Noi',
  year: 2026,
  categoryId: courseId,
  isFeatured: true,
  category: {
    id: courseId,
    slug: 'high-rise',
    name: 'High rise',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

describe('P0 API contract (HTTP)', () => {
  let app: INestApplication;
  const prisma = {
    service: {
      findMany: jest.fn().mockResolvedValue([content]),
      findFirst: jest.fn(
        ({ where }: { where: { slug?: string; id?: string } }) =>
          Promise.resolve(
            where.slug === 'valid-slug' || where.id === courseId
              ? content
              : null,
          ),
      ),
      count: jest.fn().mockResolvedValue(1),
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: courseId, ...data }),
        ),
      update: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ ...content, ...data }),
        ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    course: {
      findMany: jest.fn().mockResolvedValue([content]),
      findFirst: jest.fn(
        ({ where }: { where: { slug?: string; id?: string } }) =>
          Promise.resolve(
            where.slug === 'valid-slug' || where.id === courseId
              ? { ...content, curriculum: [] }
              : null,
          ),
      ),
      count: jest.fn().mockResolvedValue(1),
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: courseId, ...data }),
        ),
      update: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ ...content, ...data }),
        ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    post: {
      findMany: jest.fn().mockResolvedValue([content]),
      findFirst: jest.fn(
        ({ where }: { where: { slug?: string; id?: string } }) =>
          Promise.resolve(
            where.slug === 'valid-slug' || where.id === courseId
              ? content
              : null,
          ),
      ),
      count: jest.fn().mockResolvedValue(1),
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: courseId, ...data }),
        ),
      update: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ ...content, ...data }),
        ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    project: {
      findMany: jest.fn().mockResolvedValue([project]),
      findFirst: jest.fn(
        ({ where }: { where: { slug?: string; id?: string } }) =>
          Promise.resolve(
            where.slug === 'valid-slug' || where.id === courseId
              ? { ...project, images: [] }
              : null,
          ),
      ),
      count: jest.fn().mockResolvedValue(1),
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: courseId, ...data }),
        ),
      update: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ ...project, ...data }),
        ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    contact: {
      create: jest.fn().mockResolvedValue({ id: courseId }),
      findMany: jest
        .fn()
        .mockResolvedValue([
          {
            id: courseId,
            name: 'A',
            email: 'a@example.com',
            status: 'NEW',
            createdAt: new Date(),
          },
        ]),
      count: jest.fn().mockResolvedValue(1),
      findUnique: jest
        .fn()
        .mockResolvedValue({
          id: courseId,
          name: 'A',
          email: 'a@example.com',
          status: 'NEW',
        }),
      update: jest.fn().mockResolvedValue({ id: courseId, status: 'RESOLVED' }),
      delete: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    courseRegistration: {
      create: jest.fn().mockResolvedValue({ id: courseId }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue({ id: courseId }),
      update: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    newsletterSubscription: {
      upsert: jest.fn().mockResolvedValue({ id: courseId }),
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: courseId, email: 'a@example.com', isActive: true },
        ]),
      count: jest.fn().mockResolvedValue(1),
      findUnique: jest
        .fn()
        .mockResolvedValue({
          id: courseId,
          email: 'a@example.com',
          isActive: true,
        }),
      update: jest.fn().mockResolvedValue({ id: courseId, isActive: false }),
      delete: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    heroSlide: {
      findMany: jest.fn().mockResolvedValue([{ id: courseId, title: 'Hero' }]),
      create: jest.fn().mockResolvedValue({ id: courseId }),
      findUnique: jest.fn().mockResolvedValue({ id: courseId }),
      update: jest.fn().mockResolvedValue({ id: courseId }),
      delete: jest.fn(),
    },
    strategicPartner: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: courseId, name: 'Partner' }]),
      create: jest.fn().mockResolvedValue({ id: courseId }),
      findUnique: jest.fn().mockResolvedValue({ id: courseId }),
      update: jest.fn().mockResolvedValue({ id: courseId }),
      delete: jest.fn(),
    },
    adminSession: {
      findUnique: jest
        .fn()
        .mockResolvedValue({
          id: courseId,
          expiresAt: new Date('2099-01-01'),
          user: {
            id: courseId,
            email: 'admin@example.com',
            name: 'Admin',
            status: 'ACTIVE',
            roles: [{ role: 'SUPER_ADMIN' }],
          },
        }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({ id: courseId }) },
    $transaction: jest.fn(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        exceptionFactory: (errors: ValidationError[]) =>
          new UnprocessableEntityException({
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            errors: Object.fromEntries(
              errors.map((error) => [
                error.property,
                Object.values(error.constraints ?? {}),
              ]),
            ),
          }),
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });
  afterAll(async () => app?.close());

  it.each(['services', 'courses', 'posts', 'projects'])(
    'GET /%s returns compatible content',
    async (path) => {
      const response = await request(app.getHttpServer())
        .get(`/${path}`)
        .expect(200);
      const rows = Array.isArray(response.body)
        ? response.body
        : response.body.data;
      expect(rows[0]).toMatchObject({
        slug: 'valid-slug',
        title: 'Valid title',
        image: '/images/hero.jpg',
      });
    },
  );
  it.each(['services', 'courses', 'posts', 'projects'])(
    'GET /%s/:slug returns 200 and 404 correctly',
    async (path) => {
      await request(app.getHttpServer()).get(`/${path}/valid-slug`).expect(200);
      const response = await request(app.getHttpServer())
        .get(`/${path}/missing`)
        .expect(404);
      expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
    },
  );
  it('validates and stores contact', async () => {
    await request(app.getHttpServer())
      .post('/contact')
      .send({
        name: 'Nguyen Van A',
        email: 'USER@example.com',
        message: 'A valid contact message.',
      })
      .expect(201, {
        success: true,
        message: 'Yêu cầu liên hệ đã được ghi nhận.',
      });
    expect(prisma.contact.create).toHaveBeenCalled();
  });
  it('returns field validation errors', async () => {
    const response = await request(app.getHttpServer())
      .post('/contact')
      .send({ name: '', email: 'invalid', message: '' })
      .expect(422);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.errors.email).toBeDefined();
  });
  it('rejects registration for an unknown course', async () => {
    const response = await request(app.getHttpServer())
      .post('/course-registrations')
      .send({
        courseId: '22222222-2222-4222-8222-222222222222',
        name: 'Nguyen Van A',
        email: 'a@example.com',
        phone: '0900000000',
      })
      .expect(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });
  it('keeps newsletter subscription idempotent', async () => {
    const payload = { email: 'USER@example.com', consent: true };
    await request(app.getHttpServer())
      .post('/newsletter/subscriptions')
      .send(payload)
      .expect(200);
    await request(app.getHttpServer())
      .post('/newsletter/subscriptions')
      .send(payload)
      .expect(200);
    expect(prisma.newsletterSubscription.upsert).toHaveBeenCalledTimes(2);
  });
  it('protects admin endpoints and permits a valid session', async () => {
    await request(app.getHttpServer()).get('/admin/projects').expect(401);
    const response = await request(app.getHttpServer())
      .get('/admin/projects')
      .set(sessionCookie)
      .expect(200);
    expect(response.body).toMatchObject({
      data: expect.any(Array),
      meta: { page: 1, total: 1 },
    });
  });
  it('validates admin project input and supports detail/update/status/delete', async () => {
    const auth = sessionCookie;
    await request(app.getHttpServer())
      .post('/admin/projects')
      .set(auth)
      .send({ title: '' })
      .expect(422);
    await request(app.getHttpServer())
      .get(`/admin/projects/${courseId}`)
      .set(auth)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/admin/projects/${courseId}`)
      .set(auth)
      .send({ title: 'Updated project' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/admin/projects/${courseId}/status`)
      .set(auth)
      .send({ status: 'COMPLETED' })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/admin/projects/${courseId}`)
      .set(auth)
      .expect(204);
    await request(app.getHttpServer())
      .get('/admin/projects/not-a-uuid')
      .set(auth)
      .expect(400);
  });
  it.each(['services', 'courses', 'posts'])(
    'supports admin CRUD smoke for %s',
    async (domain) => {
      const body = {
        slug: `admin-${domain}`,
        title: 'Admin content',
        description: 'Valid admin content description.',
        image: '/images/hero.jpg',
        eyebrow: 'BIM4C',
        highlights: ['One'],
        sections: [{ title: 'Overview', body: 'Body' }],
        status: 'DRAFT',
      };
      await request(app.getHttpServer())
        .get(`/admin/${domain}`)
        .set(sessionCookie)
        .expect(200);
      await request(app.getHttpServer())
        .post(`/admin/${domain}`)
        .set(sessionCookie)
        .send(body)
        .expect(201);
      await request(app.getHttpServer())
        .get(`/admin/${domain}/${courseId}`)
        .set(sessionCookie)
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/admin/${domain}/${courseId}`)
        .set(sessionCookie)
        .send({ title: 'Updated' })
        .expect(200);
      await request(app.getHttpServer())
        .delete(`/admin/${domain}/${courseId}`)
        .set(sessionCookie)
        .expect(204);
    },
  );
  it('manages contacts and newsletter through authorized admin APIs', async () => {
    await request(app.getHttpServer())
      .get('/admin/contacts')
      .set(sessionCookie)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/admin/contacts/${courseId}`)
      .set(sessionCookie)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/admin/contacts/${courseId}`)
      .set(sessionCookie)
      .send({ status: 'RESOLVED' })
      .expect(200);
    await request(app.getHttpServer())
      .get('/admin/newsletter/subscriptions')
      .set(sessionCookie)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/admin/newsletter/subscriptions/${courseId}`)
      .set(sessionCookie)
      .send({ isActive: false })
      .expect(200);
  });
  it('covers homepage slide and partner CRUD with admin authorization', async () => {
    await request(app.getHttpServer())
      .get('/admin/homepage/slides')
      .set(sessionCookie)
      .expect(200);
    await request(app.getHttpServer())
      .post('/admin/homepage/slides')
      .set(sessionCookie)
      .send({
        eyebrow: 'BIM4C',
        title: 'Hero title',
        image: '/images/hero.jpg',
        alt: 'Hero image',
        sortOrder: 0,
        isActive: true,
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/admin/homepage/slides/${courseId}`)
      .set(sessionCookie)
      .send({ title: 'Updated hero' })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/admin/homepage/slides/${courseId}`)
      .set(sessionCookie)
      .expect(204);
    await request(app.getHttpServer())
      .get('/admin/homepage/partners')
      .set(sessionCookie)
      .expect(200);
    await request(app.getHttpServer())
      .post('/admin/homepage/partners')
      .set(sessionCookie)
      .send({
        name: 'Partner',
        logo: '/images/hero.jpg',
        sortOrder: 0,
        isActive: true,
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/admin/homepage/partners/${courseId}`)
      .set(sessionCookie)
      .send({ name: 'Updated partner' })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/admin/homepage/partners/${courseId}`)
      .set(sessionCookie)
      .expect(204);
  });
});
