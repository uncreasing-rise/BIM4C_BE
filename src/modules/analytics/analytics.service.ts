import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { AnalyticsEventDto } from './analytics.dto';
import {
  TIME_ZONE,
  classifySource,
  clientIp,
  contentOf,
  isBot,
  normalizePath,
  parseUserAgent,
  siteHosts,
  visitorId,
  type StoredAttribution,
} from './analytics.utils';

type Headers = Record<string, string | string[] | undefined>;

/** Events are kept for about 13 months, enough for year-on-year comparison. */
const RETENTION_DAYS = 400;
const DAY_MS = 86_400_000;
const CLICK_TYPES = ['click', 'outbound', 'download', 'contact'];

const num = (v: unknown) => (typeof v === 'bigint' ? Number(v) : typeof v === 'number' ? v : Number(v ?? 0) || 0);

export interface Range {
  from: string;
  to: string;
  start: Date;
  end: Date;
}

/** Local (Vietnam) calendar days [from, to] as a UTC half-open interval. */
export function toRange(from: string, to: string): Range {
  const start = new Date(`${from}T00:00:00+07:00`);
  const end = new Date(new Date(`${to}T00:00:00+07:00`).getTime() + DAY_MS);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start)
    throw new BadRequestException('Invalid date range');
  if (end.getTime() - start.getTime() > 400 * DAY_MS)
    throw new BadRequestException('Date range is limited to 400 days');
  return { from, to, start, end };
}

/** The period of the same length just before `range`, for comparison. */
export function previousRange(range: Range): Range {
  const length = range.end.getTime() - range.start.getTime();
  const start = new Date(range.start.getTime() - length);
  const day = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
  return { from: day(start), to: day(new Date(range.start.getTime() - DAY_MS)), start, end: range.start };
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly secret =
    process.env.ANALYTICS_SALT || process.env.DATABASE_URL || 'bim4c-analytics';
  private readonly hosts = siteHosts();

  constructor(private readonly prisma: PrismaService) {}

  // ---- Ingest ------------------------------------------------------------

  async track(events: AnalyticsEventDto[], headers: Headers, socketIp?: string): Promise<number> {
    const userAgent = String(headers['user-agent'] ?? '');
    // Crawlers, previews and monitors would drown the real visits.
    if (isBot(userAgent)) return 0;
    const visitor = visitorId(this.secret, clientIp(headers, socketIp), userAgent);
    const { device, browser, os } = parseUserAgent(userAgent);
    const countryHeader = headers['x-vercel-ip-country'];
    const country = typeof countryHeader === 'string' && /^[A-Z]{2}$/.test(countryHeader) ? countryHeader : null;
    const rows: Prisma.AnalyticsEventCreateManyInput[] = [];
    for (const e of events) {
      const page = normalizePath(e.path);
      if (!page) continue;
      const { source, medium, referrer } = classifySource({
        referrer: e.referrer,
        utmSource: e.utmSource,
        utmMedium: e.utmMedium,
        siteHosts: this.hosts,
      });
      const content = contentOf(page.path);
      rows.push({
        type: e.type,
        path: page.path,
        locale: e.locale ?? page.locale ?? null,
        target: this.target(e),
        label: e.label?.replace(/\s+/g, ' ').trim().slice(0, 200) || null,
        contentType: content?.type ?? null,
        contentSlug: content?.slug ?? null,
        source,
        medium,
        campaign: e.utmCampaign?.slice(0, 200) || null,
        referrer,
        device,
        browser,
        os,
        country,
        visitorId: visitor,
        sessionId: e.sessionId,
        durationMs: e.type === 'engagement' ? (e.durationMs ?? null) : null,
        scrollDepth: e.type === 'engagement' ? (e.scrollDepth ?? null) : null,
      });
    }
    if (!rows.length) return 0;
    try {
      await this.prisma.analyticsEvent.createMany({ data: rows });
    } catch (error) {
      // Tracking is fire-and-forget: a storage failure (e.g. the analytics
      // migration not yet deployed) must not surface as a 500 to visitors.
      this.logger.error(`Analytics ingest failed: ${(error as Error).message}`);
      return 0;
    }
    // Housekeeping without a scheduler: now and then drop expired events.
    if (Math.random() < 0.002) void this.purge();
    return rows.length;
  }

  /** Where a click went: own-site links as paths, search terms lower-cased. */
  private target(e: AnalyticsEventDto): string | null {
    if (!e.target) return null;
    if (e.type === 'search') return e.target.trim().toLowerCase().slice(0, 100) || null;
    try {
      const url = new URL(e.target, 'https://bim4c.vn');
      if (this.hosts.some((h) => url.hostname.replace(/^www\./, '') === h))
        return normalizePath(url.pathname)?.path ?? url.pathname.slice(0, 500);
      // tel:, mailto: and outside links keep only what identifies the target.
      if (url.protocol === 'tel:' || url.protocol === 'mailto:') return `${url.protocol}${url.pathname}`.slice(0, 500);
      return `${url.hostname}${url.pathname}`.slice(0, 500);
    } catch {
      return e.target.slice(0, 500);
    }
  }

  async purge(): Promise<number> {
    try {
      const { count } = await this.prisma.analyticsEvent.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * DAY_MS) } },
      });
      return count;
    } catch (error) {
      this.logger.warn(`Analytics purge failed: ${(error as Error).message}`);
      return 0;
    }
  }

  // ---- Reports -----------------------------------------------------------

  private where(range: Range) {
    return Prisma.sql`created_at >= ${range.start} AND created_at < ${range.end}`;
  }

  /** Headline numbers for a period. */
  async totals(range: Range) {
    const w = this.where(range);
    const [row] = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH sessions AS (
        SELECT session_id,
               count(*) FILTER (WHERE type = 'pageview') AS pages,
               coalesce(sum(duration_ms) FILTER (WHERE type = 'engagement'), 0) AS duration,
               bool_or(type = 'form_submit') AS converted
        FROM analytics_events WHERE ${w}
        GROUP BY session_id
        HAVING count(*) FILTER (WHERE type = 'pageview') > 0
      )
      SELECT
        (SELECT count(*) FROM analytics_events WHERE ${w} AND type = 'pageview') AS pageviews,
        (SELECT count(*) FROM (
           SELECT DISTINCT (created_at AT TIME ZONE ${TIME_ZONE})::date, visitor_id
           FROM analytics_events WHERE ${w} AND type = 'pageview') v) AS visitors,
        count(*) AS sessions,
        coalesce(avg(duration), 0) AS avg_duration,
        coalesce(avg(pages), 0) AS pages_per_session,
        count(*) FILTER (WHERE pages >= 2 OR duration >= 10000 OR converted) AS engaged,
        count(*) FILTER (WHERE converted) AS converted
      FROM sessions`;
    const sessions = num(row?.sessions);
    return {
      pageviews: num(row?.pageviews),
      visitors: num(row?.visitors),
      sessions,
      avgSessionMs: Math.round(num(row?.avg_duration)),
      pagesPerSession: Math.round(num(row?.pages_per_session) * 100) / 100,
      // An engaged session: 2+ pages, 10 s+ on the site, or a form sent (as in GA4).
      engagementRate: sessions ? num(row?.engaged) / sessions : 0,
      convertedSessions: num(row?.converted),
    };
  }

  /** Everything the analytics page shows for a period, in one round trip set. */
  async report(range: Range) {
    const w = this.where(range);
    const q = <T = Record<string, unknown>>(sql: Prisma.Sql) => this.prisma.$queryRaw<T[]>(sql);
    const firstOfSession = Prisma.sql`
      SELECT DISTINCT ON (session_id) session_id, path, source, medium, campaign, referrer,
             device, browser, os, country, locale
      FROM analytics_events WHERE ${w} AND type = 'pageview'
      ORDER BY session_id, id`;
    const converted = Prisma.sql`
      SELECT DISTINCT session_id FROM analytics_events WHERE ${w} AND type = 'form_submit'`;
    const bySession = (column: string, limit = 20) => q(Prisma.sql`
      SELECT ${Prisma.raw(column)} AS key, count(*) AS sessions
      FROM (${firstOfSession}) s GROUP BY 1 ORDER BY 2 DESC LIMIT ${limit}`);

    const [
      totals,
      previous,
      series,
      pages,
      content,
      sources,
      campaigns,
      referrers,
      entries,
      devices,
      browsers,
      systems,
      countries,
      locales,
      clicks,
      searches,
      forms,
      heatmap,
    ] = await Promise.all([
      this.totals(range),
      this.totals(previousRange(range)),
      q(Prisma.sql`
        SELECT to_char((created_at AT TIME ZONE ${TIME_ZONE})::date, 'YYYY-MM-DD') AS day,
               count(*) AS pageviews,
               count(DISTINCT session_id) AS sessions,
               count(DISTINCT visitor_id) AS visitors
        FROM analytics_events WHERE ${w} AND type = 'pageview'
        GROUP BY 1 ORDER BY 1`),
      // Time on page: a page view may report its time in parts (each time the
      // tab is hidden), so parts are added up per visit before averaging.
      q(Prisma.sql`
        WITH views AS (
          SELECT path, count(*) AS views, count(DISTINCT visitor_id) AS visitors
          FROM analytics_events WHERE ${w} AND type = 'pageview' GROUP BY path),
        reads AS (
          SELECT path, avg(ms) AS avg_ms, avg(scroll) AS scroll FROM (
            SELECT session_id, path, sum(duration_ms) AS ms, max(scroll_depth) AS scroll
            FROM analytics_events WHERE ${w} AND type = 'engagement' GROUP BY 1, 2) parts
          GROUP BY path)
        SELECT v.path, v.views, v.visitors, r.avg_ms, r.scroll
        FROM views v LEFT JOIN reads r USING (path)
        ORDER BY v.views DESC LIMIT 50`),
      q(Prisma.sql`
        WITH views AS (
          SELECT content_type, content_slug, count(*) AS views, count(DISTINCT visitor_id) AS visitors
          FROM analytics_events WHERE ${w} AND type = 'pageview' AND content_type IS NOT NULL GROUP BY 1, 2),
        reads AS (
          SELECT content_type, content_slug, avg(ms) AS avg_ms FROM (
            SELECT session_id, content_type, content_slug, sum(duration_ms) AS ms
            FROM analytics_events WHERE ${w} AND type = 'engagement' AND content_type IS NOT NULL GROUP BY 1, 2, 3) parts
          GROUP BY 1, 2)
        SELECT v.content_type, v.content_slug, v.views, v.visitors, r.avg_ms
        FROM views v LEFT JOIN reads r USING (content_type, content_slug)
        ORDER BY v.views DESC LIMIT 40`),
      q(Prisma.sql`
        SELECT s.source, s.medium, count(*) AS sessions, count(c.session_id) AS conversions
        FROM (${firstOfSession}) s LEFT JOIN (${converted}) c USING (session_id)
        GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 30`),
      q(Prisma.sql`
        SELECT s.campaign, s.source, s.medium, count(*) AS sessions, count(c.session_id) AS conversions
        FROM (${firstOfSession}) s LEFT JOIN (${converted}) c USING (session_id)
        WHERE s.campaign IS NOT NULL GROUP BY 1, 2, 3 ORDER BY 4 DESC LIMIT 20`),
      q(Prisma.sql`
        SELECT referrer AS key, count(*) AS sessions FROM (${firstOfSession}) s
        WHERE referrer IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 20`),
      q(Prisma.sql`
        SELECT s.path AS key, count(*) AS sessions, count(c.session_id) AS conversions
        FROM (${firstOfSession}) s LEFT JOIN (${converted}) c USING (session_id)
        GROUP BY 1 ORDER BY 2 DESC LIMIT 20`),
      bySession('device'),
      bySession('browser'),
      bySession('os'),
      bySession('country'),
      bySession('locale'),
      q(Prisma.sql`
        SELECT type, target, mode() WITHIN GROUP (ORDER BY label) AS label,
               count(*) AS clicks, count(DISTINCT session_id) AS sessions
        FROM analytics_events WHERE ${w} AND type IN (${Prisma.join(CLICK_TYPES)})
        GROUP BY 1, 2 ORDER BY 4 DESC LIMIT 50`),
      q(Prisma.sql`
        SELECT target AS key, count(*) AS searches
        FROM analytics_events WHERE ${w} AND type = 'search' AND target IS NOT NULL
        GROUP BY 1 ORDER BY 2 DESC LIMIT 20`),
      q(Prisma.sql`
        SELECT label AS key, count(*) AS submissions
        FROM analytics_events WHERE ${w} AND type = 'form_submit'
        GROUP BY 1 ORDER BY 2 DESC`),
      q(Prisma.sql`
        SELECT extract(isodow FROM created_at AT TIME ZONE ${TIME_ZONE})::int AS dow,
               extract(hour FROM created_at AT TIME ZONE ${TIME_ZONE})::int AS hour,
               count(*) AS views
        FROM analytics_events WHERE ${w} AND type = 'pageview'
        GROUP BY 1, 2`),
    ]);

    const rows = (list: Record<string, unknown>[], keys: string[]) =>
      list.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, keys.includes(k) ? num(v) : v])));
    const titled = await this.titles(content as { content_type: string; content_slug: string }[]);

    return {
      range: { from: range.from, to: range.to },
      previousRange: (({ from, to }) => ({ from, to }))(previousRange(range)),
      totals,
      previous,
      series: rows(series, ['pageviews', 'sessions', 'visitors']),
      pages: pages.map((r) => ({
        path: r.path as string,
        views: num(r.views),
        visitors: num(r.visitors),
        avgMs: r.avg_ms == null ? null : Math.round(num(r.avg_ms)),
        scroll: r.scroll == null ? null : Math.round(num(r.scroll)),
      })),
      content: content.map((r) => ({
        type: r.content_type as string,
        slug: r.content_slug as string,
        title: titled.get(`${String(r.content_type)}:${String(r.content_slug)}`) ?? null,
        views: num(r.views),
        visitors: num(r.visitors),
        avgMs: r.avg_ms == null ? null : Math.round(num(r.avg_ms)),
      })),
      sources: rows(sources, ['sessions', 'conversions']),
      campaigns: rows(campaigns, ['sessions', 'conversions']),
      referrers: rows(referrers, ['sessions']),
      entries: rows(entries, ['sessions', 'conversions']),
      devices: rows(devices, ['sessions']),
      browsers: rows(browsers, ['sessions']),
      systems: rows(systems, ['sessions']),
      countries: rows(countries, ['sessions']),
      locales: rows(locales, ['sessions']),
      clicks: rows(clicks, ['clicks', 'sessions']),
      searches: rows(searches, ['searches']),
      forms: rows(forms, ['submissions']),
      heatmap: rows(heatmap, ['dow', 'hour', 'views']),
    };
  }

  /** Titles (Vietnamese first) for the content rows of a report. */
  private async titles(rows: { content_type: string; content_slug: string }[]) {
    const slugs = (type: string) => rows.filter((r) => r.content_type === type).map((r) => r.content_slug);
    const select = { slug: true, title: true, title_vi: true } as const;
    const where = (type: string) => ({ where: { slug: { in: slugs(type) } }, select });
    const [projects, services, courses, posts] = await Promise.all([
      this.prisma.project.findMany(where('project')),
      this.prisma.service.findMany(where('service')),
      this.prisma.course.findMany(where('course')),
      this.prisma.post.findMany(where('post')),
    ]);
    const map = new Map<string, string>();
    for (const [type, list] of [
      ['project', projects],
      ['service', services],
      ['course', courses],
      ['post', posts],
    ] as const)
      for (const item of list) map.set(`${type}:${item.slug}`, item.title_vi || item.title);
    return map;
  }

  /** Who is on the site now: sessions active in the last 5 minutes. */
  async realtime() {
    const since = new Date(Date.now() - 5 * 60_000);
    const [active, pages, recent] = await Promise.all([
      this.prisma.$queryRaw<{ n: bigint }[]>`
        SELECT count(DISTINCT session_id) AS n FROM analytics_events WHERE created_at >= ${since}`,
      this.prisma.$queryRaw<{ path: string; sessions: bigint }[]>`
        SELECT path, count(*) AS sessions FROM (
          SELECT DISTINCT ON (session_id) session_id, path FROM analytics_events
          WHERE created_at >= ${since} AND type = 'pageview' ORDER BY session_id, id DESC) s
        GROUP BY path ORDER BY 2 DESC LIMIT 10`,
      this.prisma.analyticsEvent.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 60_000) }, type: { in: ['pageview', ...CLICK_TYPES, 'form_submit'] } },
        orderBy: { id: 'desc' },
        take: 25,
        select: { type: true, path: true, label: true, target: true, source: true, device: true, country: true, createdAt: true },
      }),
    ]);
    return {
      activeSessions: num(active[0]?.n),
      pages: pages.map((p) => ({ path: p.path, sessions: num(p.sessions) })),
      recent,
    };
  }

  /**
   * Enquiries, course registrations, appointments and subscriptions of the
   * period with how each person found the site.
   */
  async leads(range: Range) {
    const where = { createdAt: { gte: range.start, lt: range.end } };
    const pick = { id: true, name: true, email: true, createdAt: true, attribution: true } as const;
    const [contacts, registrations, appointments, subscriptions] = await Promise.all([
      this.prisma.contact.findMany({ where, select: { ...pick, company: true }, orderBy: { createdAt: 'desc' }, take: 500 }),
      this.prisma.courseRegistration.findMany({
        where,
        select: { ...pick, course: { select: { title: true, title_vi: true } } },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      this.prisma.appointment.findMany({ where, select: { ...pick, topic: true }, orderBy: { createdAt: 'desc' }, take: 500 }),
      this.prisma.newsletterSubscription.findMany({
        where,
        select: { id: true, email: true, createdAt: true, attribution: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    ]);
    const attribution = (a: Prisma.JsonValue | null) => (a && typeof a === 'object' && !Array.isArray(a) ? (a as unknown as StoredAttribution) : null);
    const items = [
      ...contacts.map((c) => ({ kind: 'contact', id: c.id, name: c.name, email: c.email, detail: c.company, createdAt: c.createdAt, attribution: attribution(c.attribution) })),
      ...registrations.map((r) => ({
        kind: 'course',
        id: r.id,
        name: r.name,
        email: r.email,
        detail: r.course ? r.course.title_vi || r.course.title : null,
        createdAt: r.createdAt,
        attribution: attribution(r.attribution),
      })),
      ...appointments.map((a) => ({ kind: 'appointment', id: a.id, name: a.name, email: a.email, detail: a.topic, createdAt: a.createdAt, attribution: attribution(a.attribution) })),
      ...subscriptions.map((s) => ({ kind: 'newsletter', id: s.id, name: null, email: s.email, detail: null, createdAt: s.createdAt, attribution: attribution(s.attribution) })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const bySource = new Map<string, { source: string; medium: string; leads: number }>();
    for (const item of items) {
      const source = item.attribution?.source ?? 'unknown';
      const medium = item.attribution?.medium ?? 'unknown';
      const key = `${source}|${medium}`;
      const entry = bySource.get(key) ?? { source, medium, leads: 0 };
      entry.leads++;
      bySource.set(key, entry);
    }
    const byKind = items.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.kind]: (acc[i.kind] ?? 0) + 1 }), {});
    return {
      total: items.length,
      byKind,
      bySource: [...bySource.values()].sort((a, b) => b.leads - a.leads),
      items: items.slice(0, 300),
    };
  }
}
