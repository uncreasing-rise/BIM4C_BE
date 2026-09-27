import { createHash } from 'node:crypto';

/**
 * Pure helpers for first-party, cookieless analytics. Nothing here stores an
 * IP address or a lasting identifier: a visitor is a hash that changes every
 * day, so visits can be counted but a person cannot be followed over time.
 */

export const EVENT_TYPES = [
  'pageview',
  'engagement',
  'click',
  'outbound',
  'download',
  'contact',
  'search',
  'form_submit',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** Tracking stays out of these (admin, API and internal Next.js routes). */
const IGNORED_PATHS = /^\/(admin|api|_next)(\/|$)/;

const BOT =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch|go-http|java\/|okhttp|scrapy|phantom|selenium|puppeteer|playwright/i;

export function isBot(userAgent: string | undefined): boolean {
  return !userAgent || userAgent.length < 10 || BOT.test(userAgent);
}

/** Days are counted in Vietnam time, where the business and most visitors are. */
export const TIME_ZONE = 'Asia/Ho_Chi_Minh';

export function localDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Anonymous visitor id for one day: a hash of a secret, the date, the IP and
 * the browser. The same visitor gets a new id tomorrow, and the IP itself is
 * never stored.
 */
export function visitorId(secret: string, ip: string, userAgent: string, now = new Date()): string {
  const salt = createHash('sha256').update(`${secret}|${localDate(now)}`).digest('hex');
  return createHash('sha256').update(`${salt}|${ip}|${userAgent}`).digest('hex').slice(0, 16);
}

/**
 * Site path without locale prefix, query, hash or trailing slash; null for
 * anything that should not be tracked.
 */
export function normalizePath(raw: string): { path: string; locale?: 'vi' | 'en' } | null {
  let path = raw.split(/[?#]/)[0] || '/';
  if (!path.startsWith('/')) return null;
  let locale: 'vi' | 'en' | undefined;
  const prefix = /^\/(vi|en)(?=\/|$)/.exec(path);
  if (prefix) {
    locale = prefix[1] as 'vi' | 'en';
    path = path.slice(3) || '/';
  }
  if (path.length > 1) path = path.replace(/\/+$/, '');
  try {
    path = decodeURI(path);
  } catch {
    /* keep it encoded */
  }
  if (IGNORED_PATHS.test(path)) return null;
  return { path: path.slice(0, 500), locale };
}

const CONTENT_ROUTES: [RegExp, string][] = [
  [/^\/du-an\/([^/]+)$/, 'project'],
  [/^\/dich-vu\/([^/]+)$/, 'service'],
  [/^\/khoa-hoc\/([^/]+)$/, 'course'],
  [/^\/(?:tin-tuc|chuyen-mon|blog)\/([^/]+)$/, 'post'],
];

/** Which project, service, course or post a page shows. */
export function contentOf(path: string): { type: string; slug: string } | null {
  for (const [pattern, type] of CONTENT_ROUTES) {
    const match = pattern.exec(path);
    if (match) return { type, slug: match[1].slice(0, 200) };
  }
  return null;
}

export function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase().slice(0, 255) || null;
  } catch {
    return null;
  }
}

const SEARCH = /(^|\.)(google|bing|yahoo|duckduckgo|coccoc|yandex|baidu|ecosia|naver)\./;
const SOCIAL: [RegExp, string][] = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, 'facebook'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'linkedin'],
  [/(^|\.)(zalo\.me|zalo\.vn|zaloapp\.com)$/, 'zalo'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'x'],
  [/(^|\.)(instagram\.com)$/, 'instagram'],
  [/(^|\.)(tiktok\.com)$/, 'tiktok'],
];

/**
 * Where a session came from, in the usual source / medium terms: UTM tags
 * win, then the referring site (search, social or referral), else direct.
 */
export function classifySource(input: {
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  siteHosts?: string[];
}): { source: string; medium: string; referrer: string | null } {
  const referrer = hostOf(input.referrer);
  const own = referrer && (input.siteHosts ?? []).some((h) => referrer === h || referrer.endsWith(`.${h}`));
  const external = own ? null : referrer;
  if (input.utmSource)
    return {
      source: input.utmSource.toLowerCase().slice(0, 100),
      medium: (input.utmMedium || 'campaign').toLowerCase().slice(0, 100),
      referrer: external,
    };
  if (!external) return { source: 'direct', medium: 'none', referrer: null };
  const search = SEARCH.exec(external);
  if (search) return { source: search[2], medium: 'organic', referrer: external };
  for (const [pattern, name] of SOCIAL)
    if (pattern.test(external)) return { source: name, medium: 'social', referrer: external };
  return { source: external, medium: 'referral', referrer: external };
}

/** Coarse device, browser and OS: enough for a report, not a fingerprint. */
export function parseUserAgent(ua: string): { device: string; browser: string; os: string } {
  const device = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)
    ? 'tablet'
    : /Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)
      ? 'mobile'
      : 'desktop';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /coc_coc_browser/i.test(ua)
        ? 'Cốc Cốc'
        : /SamsungBrowser/.test(ua)
          ? 'Samsung Internet'
          : /Zalo/i.test(ua)
            ? 'Zalo'
            : /FBAN|FBAV|FB_IAB/.test(ua)
              ? 'Facebook'
              : /Firefox\/|FxiOS/.test(ua)
                ? 'Firefox'
                : /Chrome\/|CriOS/.test(ua)
                  ? 'Chrome'
                  : /Safari\//.test(ua)
                    ? 'Safari'
                    : 'Other';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macOS'
          : /CrOS/.test(ua)
            ? 'ChromeOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Other';
  return { device, browser, os };
}

/** First IP in the forwarding chain (Vercel puts the client first). */
export function clientIp(headers: Record<string, string | string[] | undefined>, fallback = ''): string {
  const pick = (h: string | string[] | undefined) => (Array.isArray(h) ? h[0] : h);
  const forwarded = pick(headers['x-forwarded-for'])?.split(',')[0]?.trim();
  return forwarded || pick(headers['x-real-ip'])?.trim() || fallback;
}

/** Hosts of the site itself: their referrers are page-to-page, not a source. */
export function siteHosts(env: NodeJS.ProcessEnv = process.env): string[] {
  const urls = [env.FRONTEND_URL, ...(env.CORS_ORIGINS ?? '').split(',')];
  const hosts = new Set(['bim4c.vn', 'localhost']);
  for (const url of urls) {
    const host = hostOf(url?.trim());
    if (host) hosts.add(host);
  }
  return [...hosts];
}

// A type alias (not an interface) so it fits Prisma JSON input.
export type StoredAttribution = {
  source: string;
  medium: string;
  campaign?: string;
  referrer?: string;
  landingPage?: string;
  pages?: string[];
  sessionId?: string;
};

/**
 * What a form stores about how the lead arrived: the classified source, the
 * referring host (never the full URL, which may carry personal data), the
 * landing page and the last pages viewed.
 */
export function leadAttribution(
  input:
    | {
        referrer?: string;
        utmSource?: string;
        utmMedium?: string;
        utmCampaign?: string;
        landingPage?: string;
        pages?: string[];
        sessionId?: string;
      }
    | undefined,
  hosts = siteHosts(),
): StoredAttribution | undefined {
  if (!input) return undefined;
  const { source, medium, referrer } = classifySource({ ...input, siteHosts: hosts });
  const page = (p: string) => normalizePath(p)?.path;
  const pages = (input.pages ?? []).map(page).filter((p): p is string => Boolean(p));
  return {
    source,
    medium,
    ...(input.utmCampaign ? { campaign: input.utmCampaign.slice(0, 200) } : {}),
    ...(referrer ? { referrer } : {}),
    ...(input.landingPage && page(input.landingPage) ? { landingPage: page(input.landingPage) } : {}),
    ...(pages.length ? { pages } : {}),
    ...(input.sessionId ? { sessionId: input.sessionId.slice(0, 40) } : {}),
  };
}
