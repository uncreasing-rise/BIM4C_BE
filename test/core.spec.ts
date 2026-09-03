import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { pageResponse } from '../src/common/pagination/page-query.dto';
import { CreateNewsletterSubscriptionDto } from '../src/modules/newsletter/create-newsletter-subscription.dto';
import { normalizeEmail, normalizeText } from '../src/common/utils/input';
import { BadRequestException } from '@nestjs/common';
import { SlugPipe } from '../src/common/pipes/slug.pipe';
import { mapContent } from '../src/common/dto/content-response.dto';
import { validateEnvironment } from '../src/config/env';

describe('backend contract primitives', () => {
  it('builds FE-compatible pagination metadata', () => {
    expect(pageResponse(['a'], 25, 2, 10)).toEqual({
      data: ['a'],
      meta: { page: 2, limit: 10, total: 25, totalPages: 3 },
    });
  });
  it('normalizes public mutation input', () => {
    expect(normalizeEmail(' User@Example.COM ')).toBe('user@example.com');
    expect(normalizeText('  BIM4C\n contact  ')).toBe('BIM4C contact');
  });
  it('requires newsletter consent', async () => {
    const dto = plainToInstance(CreateNewsletterSubscriptionDto, {
      email: 'USER@example.com',
      consent: false,
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'consent')).toBe(true);
    expect(dto.email).toBe('user@example.com');
  });
  it('accepts URL-safe slugs and rejects unsafe values', () => {
    const pipe = new SlugPipe();
    expect(pipe.transform('lumi-hanoi')).toBe('lumi-hanoi');
    expect(() => pipe.transform('../draft')).toThrow(BadRequestException);
  });
  it('maps stored content without exposing database fields', () => {
    const response = mapContent({
      id: 'id',
      slug: 'post',
      title: 'Post',
      description: 'Description',
      image: '/image.jpg',
      eyebrow: 'News',
      meta: null,
      highlights: ['One'],
      sections: [{ title: 'Section', body: 'Body' }],
    });
    expect(response).toEqual({
      id: 'id',
      slug: 'post',
      title: 'Post',
      description: 'Description',
      image: '/image.jpg',
      eyebrow: 'News',
      meta: null,
      highlights: ['One'],
      sections: [{ title: 'Section', body: 'Body' }],
      seoTitle: null,
      seoDescription: null,
      seoImage: null,
      canonicalUrl: null,
      relatedIds: [],
      status: 'published',
      publishedAt: null,
      createdAt: '',
      updatedAt: '',
    });
    expect(response).not.toHaveProperty('deletedAt');
  });
  it('validates stored blocks and safely drops unknown or unsafe content', () => {
    const response = mapContent({
      id: 'id', slug: 'safe-blocks', title: 'Blocks', description: 'Description', image: '/image.jpg', eyebrow: 'News', meta: null,
      highlights: [], sections: [],
      contentBlocks: [
        { id: 'text', type: 'rich-text', content: 'Safe text' },
        { id: 'bad', type: 'video', url: 'javascript:alert(1)' },
        { id: 'unknown', type: 'html', content: '<script>alert(1)</script>' },
      ],
    });
    expect(response.contentBlocks).toEqual([{ id: 'text', type: 'rich-text', content: 'Safe text' }]);
  });
  it('parses false environment booleans without truthy string coercion', () => {
    const env = validateEnvironment({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
      TEMPORARY_ADMIN_AUTH: 'false',
      ADMIN_BOOTSTRAP_RESET_PASSWORD: 'false',
    });
    expect(env.TEMPORARY_ADMIN_AUTH).toBe(false);
    expect(env.ADMIN_BOOTSTRAP_RESET_PASSWORD).toBe(false);
  });
  it('reports quoted database URLs as configuration errors', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: '"postgresql://user:pass@localhost:5432/test"',
      }),
    ).toThrow(/Invalid environment: DATABASE_URL/);
  });
  it('rejects unsafe local configuration in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
        FRONTEND_URL: 'http://localhost:3000',
        CORS_ORIGINS: 'http://localhost:3000',
        MEDIA_STORAGE_DRIVER: 'local',
        PUBLIC_API_URL: 'http://localhost:8080',
      }),
    ).toThrow(/Invalid environment/);
  });
});
