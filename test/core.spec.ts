import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { pageResponse } from '../src/common/pagination/page-query.dto';
import { CreateNewsletterSubscriptionDto } from '../src/modules/newsletter/create-newsletter-subscription.dto';
import { normalizeEmail, normalizeText } from '../src/common/utils/input';
import { BadRequestException } from '@nestjs/common';
import { SlugPipe } from '../src/common/pipes/slug.pipe';
import { mapContent } from '../src/common/dto/content-response.dto';

describe('backend contract primitives', () => {
  it('builds FE-compatible pagination metadata', () => { expect(pageResponse(['a'], 25, 2, 10)).toEqual({ data: ['a'], meta: { page: 2, limit: 10, total: 25, totalPages: 3 } }); });
  it('normalizes public mutation input', () => { expect(normalizeEmail(' User@Example.COM ')).toBe('user@example.com'); expect(normalizeText('  BIM4C\n contact  ')).toBe('BIM4C contact'); });
  it('requires newsletter consent', async () => { const dto = plainToInstance(CreateNewsletterSubscriptionDto, { email: 'USER@example.com', consent: false }); const errors = await validate(dto); expect(errors.some((error) => error.property === 'consent')).toBe(true); expect(dto.email).toBe('user@example.com'); });
  it('accepts URL-safe slugs and rejects unsafe values', () => { const pipe = new SlugPipe(); expect(pipe.transform('lumi-hanoi')).toBe('lumi-hanoi'); expect(() => pipe.transform('../draft')).toThrow(BadRequestException); });
  it('maps stored content without exposing database fields', () => { const response = mapContent({ id: 'id', slug: 'post', title: 'Post', description: 'Description', image: '/image.jpg', eyebrow: 'News', meta: null, highlights: ['One'], sections: [{ title: 'Section', body: 'Body' }] }); expect(response).toEqual({ id: 'id', slug: 'post', title: 'Post', description: 'Description', image: '/image.jpg', eyebrow: 'News', meta: null, highlights: ['One'], sections: [{ title: 'Section', body: 'Body' }] }); expect(response).not.toHaveProperty('deletedAt'); });
});
