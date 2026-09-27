/** Editable page blocks. The frontend hides a block whose row is missing or empty. */
export const PAGE_CONTENT_KEYS = [
  'home.hero',
  'company',
  'about',
  'courses.learning',
  'services.guide',
  'services.faq',
  'contact',
  'detail',
] as const;

export type PageContentKey = (typeof PAGE_CONTENT_KEYS)[number];

export const isPageContentKey = (key: string): key is PageContentKey =>
  (PAGE_CONTENT_KEYS as readonly string[]).includes(key);
