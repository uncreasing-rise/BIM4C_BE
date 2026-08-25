import type { Prisma } from '@prisma/client';
export interface ContentSection { title: string; body: string }
export interface ContentResponse { id: string; slug: string; title: string; description: string; image: string; eyebrow: string; meta: string | null; highlights: string[]; sections: ContentSection[] }
interface ContentRecord extends Omit<ContentResponse, 'highlights' | 'sections'> { highlights: Prisma.JsonValue; sections: Prisma.JsonValue }
function isSection(value: unknown): value is ContentSection { return typeof value === 'object' && value !== null && 'title' in value && typeof value.title === 'string' && 'body' in value && typeof value.body === 'string'; }
export function mapContent(record: ContentRecord): ContentResponse {
  if (!Array.isArray(record.highlights) || !record.highlights.every((item) => typeof item === 'string')) throw new Error(`Invalid highlights stored for ${record.slug}`);
  if (!Array.isArray(record.sections) || !record.sections.every(isSection)) throw new Error(`Invalid sections stored for ${record.slug}`);
  return { id: record.id, slug: record.slug, title: record.title, description: record.description, image: record.image, eyebrow: record.eyebrow, meta: record.meta, highlights: record.highlights, sections: record.sections as unknown as ContentSection[] };
}
