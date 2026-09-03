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
  description: string;
  image: string;
  eyebrow: string;
  meta: string | null;
  highlights: string[];
  sections: ContentSection[];
  contentBlocks?: ContentBlock[];
  seoTitle: string | null;
  seoDescription: string | null;
  seoImage: string | null;
  canonicalUrl: string | null;
  relatedIds: string[];
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
interface ContentRecord extends Omit<
  ContentResponse,
  'highlights' | 'sections' | 'contentBlocks' | 'relatedIds' | 'status' | 'publishedAt' | 'createdAt' | 'updatedAt' | 'seoTitle' | 'seoDescription' | 'seoImage' | 'canonicalUrl'
> {
  highlights: Prisma.JsonValue;
  sections: Prisma.JsonValue;
  contentBlocks?: Prisma.JsonValue | null;
  relatedIds?: Prisma.JsonValue | null;
  status?: string;
  publishedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  seoTitle?: string | null;
  seoDescription?: string | null;
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
    description: record.description,
    image: record.image,
    eyebrow: record.eyebrow,
    meta: record.meta,
    highlights: record.highlights,
    sections: record.sections as unknown as ContentSection[],
    ...(record.contentBlocks == null ? {} : { contentBlocks }),
    seoTitle: record.seoTitle ?? null,
    seoDescription: record.seoDescription ?? null,
    seoImage: record.seoImage ?? null,
    canonicalUrl: record.canonicalUrl ?? null,
    relatedIds,
    status: record.status?.toLowerCase() ?? 'published',
    publishedAt: record.publishedAt?.toISOString() ?? null,
    createdAt: record.createdAt?.toISOString() ?? '',
    updatedAt: record.updatedAt?.toISOString() ?? '',
  };
}
