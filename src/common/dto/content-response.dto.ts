import type { Prisma } from '@prisma/client';
export interface ContentMedia {
  url: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
}
export interface ContentSection {
  title: string;
  body: string;
  images?: ContentMedia[];
  imageLayout?: 'stack' | 'grid';
  unorderedList?: string[];
  orderedList?: string[];
  quote?: string;
  videoUrl?: string;
}
export type ContentBlock =
  | { id: string; type: 'rich-text'; heading?: string; content: string }
  | { id: string; type: 'image'; image: ContentMedia }
  | { id: string; type: 'gallery'; images: ContentMedia[] }
  | { id: string; type: 'quote'; quote: string; author?: string }
  | { id: string; type: 'feature-list'; heading?: string; items: string[]; ordered?: boolean }
  | { id: string; type: 'video'; url: string; title?: string }
  | { id: string; type: 'divider' };
export interface ContentResponse {
  id: string;
  slug: string;
  title: string;
  title_vi?: string | null;
  description: string;
  description_vi?: string | null;
  image: string;
  eyebrow: string;
  eyebrow_vi?: string | null;
  meta: string | null;
  meta_vi?: string | null;
  highlights: string[];
  highlights_vi?: string[];
  sections: ContentSection[];
  sections_vi?: ContentSection[];
  contentBlocks?: ContentBlock[];
  contentBlocks_vi?: ContentBlock[];
  seoTitle: string | null;
  seoTitle_vi?: string | null;
  seoDescription: string | null;
  seoDescription_vi?: string | null;
  seoImage: string | null;
  canonicalUrl: string | null;
  relatedIds: string[];
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentSummaryRecord {
  id: string;
  slug: string;
  title: string;
  title_vi?: string | null;
  description: string;
  description_vi?: string | null;
  image: string;
  eyebrow: string;
  eyebrow_vi?: string | null;
  meta?: string | null;
  meta_vi?: string | null;
  seoTitle?: string | null;
  seoTitle_vi?: string | null;
  seoDescription?: string | null;
  seoDescription_vi?: string | null;
  seoImage?: string | null;
  canonicalUrl?: string | null;
  status?: string;
  publishedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Maps only fields needed by catalogue cards, avoiding large content JSON columns. */
export function mapContentSummary(record: ContentSummaryRecord): ContentResponse {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    ...(record.title_vi ? { title_vi: record.title_vi } : {}),
    description: record.description,
    ...(record.description_vi ? { description_vi: record.description_vi } : {}),
    image: record.image,
    eyebrow: record.eyebrow,
    ...(record.eyebrow_vi ? { eyebrow_vi: record.eyebrow_vi } : {}),
    meta: record.meta ?? null,
    ...(record.meta_vi ? { meta_vi: record.meta_vi } : {}),
    highlights: [],
    sections: [],
    seoTitle: record.seoTitle ?? null,
    ...(record.seoTitle_vi ? { seoTitle_vi: record.seoTitle_vi } : {}),
    seoDescription: record.seoDescription ?? null,
    ...(record.seoDescription_vi ? { seoDescription_vi: record.seoDescription_vi } : {}),
    seoImage: record.seoImage ?? null,
    canonicalUrl: record.canonicalUrl ?? null,
    relatedIds: [],
    status: record.status?.toLowerCase() ?? 'published',
    publishedAt: record.publishedAt?.toISOString() ?? null,
    createdAt: record.createdAt?.toISOString() ?? '',
    updatedAt: record.updatedAt?.toISOString() ?? '',
  };
}
interface ContentRecord extends Omit<
  ContentResponse,
  'highlights' | 'sections' | 'contentBlocks' | 'relatedIds' | 'status' | 'publishedAt' | 'createdAt' | 'updatedAt' | 'seoTitle' | 'seoDescription' | 'seoImage' | 'canonicalUrl' | 'highlights_vi' | 'sections_vi' | 'contentBlocks_vi'
> {
  title_vi?: string | null;
  description_vi?: string | null;
  eyebrow_vi?: string | null;
  meta_vi?: string | null;
  highlights: Prisma.JsonValue;
  highlights_vi?: Prisma.JsonValue | null;
  sections: Prisma.JsonValue;
  sections_vi?: Prisma.JsonValue | null;
  contentBlocks?: Prisma.JsonValue | null;
  contentBlocks_vi?: Prisma.JsonValue | null;
  relatedIds?: Prisma.JsonValue | null;
  status?: string;
  publishedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  seoTitle?: string | null;
  seoTitle_vi?: string | null;
  seoDescription?: string | null;
  seoDescription_vi?: string | null;
  seoImage?: string | null;
  canonicalUrl?: string | null;
}
function isSection(value: unknown): value is ContentSection {
  return (
    typeof value === 'object' &&
    value !== null &&
    'title' in value &&
    typeof value.title === 'string' &&
    'body' in value &&
    typeof value.body === 'string'
  );
}
const stringValue = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const safeMedia = (value: unknown): value is ContentMedia => typeof value === 'object' && value !== null && 'url' in value && stringValue(value.url) && (/^\/(?!\/)/.test(value.url) || /^https:\/\//i.test(value.url) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(value.url));
export function isContentBlock(value: unknown): value is ContentBlock {
  if (typeof value !== 'object' || value === null || !('id' in value) || !stringValue(value.id) || !('type' in value) || typeof value.type !== 'string') return false;
  switch (value.type) {
    case 'rich-text': return 'content' in value && stringValue(value.content);
    case 'image': return 'image' in value && safeMedia(value.image);
    case 'gallery': return 'images' in value && Array.isArray(value.images) && value.images.length > 0 && value.images.length <= 24 && value.images.every(safeMedia);
    case 'quote': return 'quote' in value && stringValue(value.quote);
    case 'feature-list': return 'items' in value && Array.isArray(value.items) && value.items.length > 0 && value.items.every(stringValue);
    case 'video': return 'url' in value && stringValue(value.url) && (/^\/(?!\/)/.test(value.url) || /^https:\/\//i.test(value.url) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(value.url));
    case 'divider': return true;
    default: return false;
  }
}
export function mapContent(record: ContentRecord): ContentResponse {
  if (
    !Array.isArray(record.highlights) ||
    !record.highlights.every((item) => typeof item === 'string')
  )
    throw new Error(`Invalid highlights stored for ${record.slug}`);
  if (!Array.isArray(record.sections) || !record.sections.every(isSection))
    throw new Error(`Invalid sections stored for ${record.slug}`);
  const contentBlocks: ContentBlock[] = Array.isArray(record.contentBlocks)
    ? (record.contentBlocks as unknown[]).filter(isContentBlock)
    : [];
  const relatedIds = Array.isArray(record.relatedIds)
    ? record.relatedIds.filter(stringValue)
    : [];
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    ...(record.title_vi ? { title_vi: record.title_vi } : {}),
    description: record.description,
    ...(record.description_vi ? { description_vi: record.description_vi } : {}),
    image: record.image,
    eyebrow: record.eyebrow,
    ...(record.eyebrow_vi ? { eyebrow_vi: record.eyebrow_vi } : {}),
    meta: record.meta,
    ...(record.meta_vi ? { meta_vi: record.meta_vi } : {}),
    highlights: record.highlights,
    ...(Array.isArray(record.highlights_vi) ? { highlights_vi: record.highlights_vi.filter(stringValue) } : {}),
    sections: record.sections as unknown as ContentSection[],
    ...(Array.isArray(record.sections_vi) ? { sections_vi: record.sections_vi.filter(isSection) as unknown as ContentSection[] } : {}),
    ...(record.contentBlocks == null ? {} : { contentBlocks }),
    ...(Array.isArray(record.contentBlocks_vi) ? { contentBlocks_vi: record.contentBlocks_vi.filter(isContentBlock) as ContentBlock[] } : {}),
    seoTitle: record.seoTitle ?? null,
    ...(record.seoTitle_vi ? { seoTitle_vi: record.seoTitle_vi } : {}),
    seoDescription: record.seoDescription ?? null,
    ...(record.seoDescription_vi ? { seoDescription_vi: record.seoDescription_vi } : {}),
    seoImage: record.seoImage ?? null,
    canonicalUrl: record.canonicalUrl ?? null,
    relatedIds,
    status: record.status?.toLowerCase() ?? 'published',
    publishedAt: record.publishedAt?.toISOString() ?? null,
    createdAt: record.createdAt?.toISOString() ?? '',
    updatedAt: record.updatedAt?.toISOString() ?? '',
  };
}
