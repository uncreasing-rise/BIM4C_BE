import {
  classifySource,
  clientIp,
  contentOf,
  isBot,
  leadAttribution,
  normalizePath,
  parseUserAgent,
  visitorId,
} from './analytics.utils';
import { previousRange, toRange } from './analytics.service';

const CHROME_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const COCCOC =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) coc_coc_browser/140.0.0 Chrome/134.0.0.0 Safari/537.36';
const HOSTS = ['bim4c.vn', 'localhost'];

describe('analytics utils', () => {
  it('drops crawlers and tools but keeps browsers', () => {
    expect(isBot('Googlebot/2.1 (+http://www.google.com/bot.html)')).toBe(true);
    expect(isBot('facebookexternalhit/1.1')).toBe(true);
    expect(isBot('Mozilla/5.0 HeadlessChrome/120')).toBe(true);
    expect(isBot(undefined)).toBe(true);
    expect(isBot(CHROME_WIN)).toBe(false);
    expect(isBot(SAFARI_IPHONE)).toBe(false);
  });

  it('gives a visitor a stable id within a day and a new one the next day, without the IP', () => {
    const day = new Date('2026-09-28T03:00:00Z');
    const a = visitorId('secret', '203.0.113.9', CHROME_WIN, day);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(visitorId('secret', '203.0.113.9', CHROME_WIN, new Date('2026-09-28T15:00:00Z'))).toBe(a);
    expect(visitorId('secret', '203.0.113.9', CHROME_WIN, new Date('2026-09-29T03:00:00Z'))).not.toBe(a);
    expect(visitorId('secret', '203.0.113.10', CHROME_WIN, day)).not.toBe(a);
    expect(a).not.toContain('203');
  });

  it('counts days in Vietnam time', () => {
    // 23:30 UTC on the 27th is 06:30 on the 28th in Vietnam: same day as noon on the 28th.
    const late = visitorId('s', 'ip', CHROME_WIN, new Date('2026-09-27T23:30:00Z'));
    expect(visitorId('s', 'ip', CHROME_WIN, new Date('2026-09-28T05:00:00Z'))).toBe(late);
  });

  it('normalises paths: locale prefix, query, trailing slash; admin is ignored', () => {
    expect(normalizePath('/vi/du-an/nha-may-a/?utm_source=x#top')).toEqual({ path: '/du-an/nha-may-a', locale: 'vi' });
    expect(normalizePath('/en')).toEqual({ path: '/', locale: 'en' });
    expect(normalizePath('/khoa-hoc')).toEqual({ path: '/khoa-hoc', locale: undefined });
    expect(normalizePath('/vi/admin/du-an')).toBeNull();
    expect(normalizePath('/api/x')).toBeNull();
    expect(normalizePath('https://evil.test/')).toBeNull();
    expect(normalizePath('/chuyen-mon/kh%E1%BA%A3o-s%C3%A1t')?.path).toBe('/chuyen-mon/khảo-sát');
  });

  it('maps detail pages to their content', () => {
    expect(contentOf('/du-an/nha-may-a')).toEqual({ type: 'project', slug: 'nha-may-a' });
    expect(contentOf('/dich-vu/scan-to-bim')).toEqual({ type: 'service', slug: 'scan-to-bim' });
    expect(contentOf('/khoa-hoc/revit-co-ban')).toEqual({ type: 'course', slug: 'revit-co-ban' });
    expect(contentOf('/chuyen-mon/iso-19650')).toEqual({ type: 'post', slug: 'iso-19650' });
    expect(contentOf('/tin-tuc/ra-mat')).toEqual({ type: 'post', slug: 'ra-mat' });
    expect(contentOf('/du-an')).toBeNull();
  });

  it('classifies sources: UTM first, then search, social, referral, direct', () => {
    expect(classifySource({ utmSource: 'Newsletter', utmMedium: 'Email', referrer: 'https://www.google.com/' })).toEqual({
      source: 'newsletter',
      medium: 'email',
      referrer: 'google.com',
    });
    expect(classifySource({ referrer: 'https://www.google.com.vn/' }).medium).toBe('organic');
    expect(classifySource({ referrer: 'https://coccoc.com/search?query=bim' })).toMatchObject({ source: 'coccoc', medium: 'organic' });
    expect(classifySource({ referrer: 'https://l.facebook.com/l.php?u=x' })).toMatchObject({ source: 'facebook', medium: 'social' });
    expect(classifySource({ referrer: 'https://www.linkedin.com/feed/' })).toMatchObject({ source: 'linkedin', medium: 'social' });
    expect(classifySource({ referrer: 'https://zalo.me/g/abc' })).toMatchObject({ source: 'zalo', medium: 'social' });
    expect(classifySource({ referrer: 'https://partner.example.org/news' })).toEqual({
      source: 'partner.example.org',
      medium: 'referral',
      referrer: 'partner.example.org',
    });
    expect(classifySource({ referrer: 'https://www.bim4c.vn/du-an', siteHosts: HOSTS })).toEqual({
      source: 'direct',
      medium: 'none',
      referrer: null,
    });
    expect(classifySource({})).toEqual({ source: 'direct', medium: 'none', referrer: null });
  });

  it('reads device, browser and OS coarsely', () => {
    expect(parseUserAgent(CHROME_WIN)).toEqual({ device: 'desktop', browser: 'Chrome', os: 'Windows' });
    expect(parseUserAgent(SAFARI_IPHONE)).toEqual({ device: 'mobile', browser: 'Safari', os: 'iOS' });
    expect(parseUserAgent(COCCOC).browser).toBe('Cốc Cốc');
  });

  it('takes the client IP first in the forwarding chain', () => {
    expect(clientIp({ 'x-forwarded-for': '198.51.100.7, 10.0.0.1' })).toBe('198.51.100.7');
    expect(clientIp({ 'x-real-ip': '198.51.100.8' })).toBe('198.51.100.8');
    expect(clientIp({}, '127.0.0.1')).toBe('127.0.0.1');
  });

  it('stores a lead attribution without full referrer URLs', () => {
    const stored = leadAttribution(
      {
        referrer: 'https://www.facebook.com/some/post?email=a@b.c',
        landingPage: '/vi/dich-vu/scan-to-bim?utm_source=fb',
        pages: ['/vi/dich-vu/scan-to-bim', '/vi/lien-he', '/vi/admin/x'],
        sessionId: 'abc-123',
      },
      HOSTS,
    );
    expect(stored).toEqual({
      source: 'facebook',
      medium: 'social',
      referrer: 'facebook.com',
      landingPage: '/dich-vu/scan-to-bim',
      pages: ['/dich-vu/scan-to-bim', '/lien-he'],
      sessionId: 'abc-123',
    });
    expect(JSON.stringify(stored)).not.toContain('email');
    expect(leadAttribution(undefined)).toBeUndefined();
  });

  it('turns local days into a UTC range and finds the previous period', () => {
    const range = toRange('2026-09-01', '2026-09-30');
    expect(range.start.toISOString()).toBe('2026-08-31T17:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    const previous = previousRange(range);
    expect(previous.to).toBe('2026-08-31');
    expect(previous.from).toBe('2026-08-02');
    expect(previous.end).toEqual(range.start);
    expect(() => toRange('2026-09-30', '2026-09-01')).toThrow();
    expect(() => toRange('2024-01-01', '2026-01-01')).toThrow();
  });
});
