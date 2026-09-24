import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, createSign, randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Appointment } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

type CalendarResult = { id: string; htmlLink?: string; hangoutLink?: string; conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] } };

const encode = (value: string) => Buffer.from(value).toString('base64url');
const OUTBOUND_TIMEOUT_MS = 10_000;
const OAUTH_STATE_TTL_MS = 10 * 60_000;
/** Google and Resend calls run inside admin requests; never let them hang. */
const timedFetch = (url: string, init: RequestInit = {}) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS) });
const escapeHtml = (value: string | null | undefined) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

@Injectable()
export class AppointmentNotificationsService {
  private readonly logger = new Logger(AppointmentNotificationsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async notifyRequested(appointment: Appointment): Promise<void> {
    await Promise.all([
      this.sendEmail({
        to: appointment.email,
        subject: 'BIM4C đã nhận yêu cầu đặt lịch tư vấn',
        html: this.customerRequestEmail(appointment),
      }),
      this.sendEmail({
        to: this.config.get<string>('APPOINTMENT_ADMIN_EMAIL'),
        subject: `Yêu cầu tư vấn mới: ${appointment.topic}`,
        html: this.adminRequestEmail(appointment),
      }),
    ]);
  }

  async confirm(appointment: Appointment): Promise<Appointment> {
    let calendar: CalendarResult | null = null;
    if (appointment.calendarEventId) {
      await this.trySendEmail({ to: appointment.email, subject: 'Lịch tư vấn BIM4C đã được xác nhận', html: this.customerConfirmedEmail(appointment) });
      return appointment;
    }
    if (this.googleConfigured()) {
      calendar = await this.createCalendarEvent(appointment);
      const meetingUrl = this.meetingUrl(calendar);
      return this.prisma.appointment.update({
        where: { id: appointment.id },
        data: { calendarEventId: calendar.id, meetingUrl },
      }).then(async (updated) => {
        await Promise.all([
          this.trySendEmail({ to: updated.email, subject: 'Lịch tư vấn BIM4C đã được xác nhận', html: this.customerConfirmedEmail(updated) }),
          this.trySendEmail({ to: this.config.get<string>('APPOINTMENT_ADMIN_EMAIL'), subject: `Đã xác nhận lịch: ${updated.topic}`, html: this.adminConfirmedEmail(updated) }),
        ]);
        return updated;
      });
    }

    this.logger.warn('Google Calendar is not configured; appointment confirmed without a Meet link');
    await this.trySendEmail({ to: appointment.email, subject: 'Lịch tư vấn BIM4C đã được xác nhận', html: this.customerConfirmedEmail(appointment) });
    return appointment;
  }

  async cancel(appointment: Appointment): Promise<void> {
    if (appointment.calendarEventId && this.googleConfigured()) {
      try {
        const token = await this.googleAccessToken();
        const calendarId = encodeURIComponent(this.config.getOrThrow<string>('GOOGLE_CALENDAR_ID'));
        await timedFetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(appointment.calendarEventId)}?sendUpdates=all`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
        });
      } catch (error) {
        this.logger.error(`Could not cancel Google Calendar event: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    await this.sendEmail({ to: appointment.email, subject: 'Lịch tư vấn BIM4C đã được hủy', html: this.customerCancelledEmail(appointment) });
  }

  /**
   * Signed OAuth `state` bound to the admin session that started the flow, so a
   * callback cannot be replayed from another browser (OAuth login CSRF). It is
   * stateless on purpose: serverless instances share no memory.
   */
  private oauthState(sessionId: string, expiresAt: number): string {
    const secret =
      this.config.get<string>('OAUTH_STATE_SECRET') ??
      this.config.get<string>('REVALIDATION_SECRET');
    if (!secret)
      throw new ConflictException(
        'OAUTH_STATE_SECRET must be configured to connect Google Calendar',
      );
    const signature = createHmac('sha256', secret)
      .update(`${sessionId}.${expiresAt}`)
      .digest('base64url');
    return `${expiresAt}.${signature}`;
  }

  private verifyOauthState(state: string | undefined, sessionId: string) {
    const [expires, signature] = (state ?? '').split('.');
    const expiresAt = Number(expires);
    if (!signature || !Number.isFinite(expiresAt) || expiresAt < Date.now())
      throw new BadRequestException('Invalid or expired OAuth state');
    const expected = Buffer.from(
      this.oauthState(sessionId, expiresAt).split('.')[1],
    );
    const received = Buffer.from(signature);
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    )
      throw new BadRequestException('Invalid or expired OAuth state');
  }

  googleAuthorizationUrl(sessionId: string): string {
    const client = this.oauthClient();
    if (!client) throw new ConflictException('Google OAuth client is not configured');
    const params = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: this.config.getOrThrow<string>('GOOGLE_OAUTH_REDIRECT_URI'),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      state: this.oauthState(sessionId, Date.now() + OAUTH_STATE_TTL_MS),
      scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/meetings.space.created',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async completeGoogleAuthorization(
    code: string | undefined,
    state: string | undefined,
    sessionId: string,
  ): Promise<void> {
    this.verifyOauthState(state, sessionId);
    if (!code) throw new BadRequestException('Missing authorization code');
    const client = this.oauthClient();
    if (!client) throw new ConflictException('Google OAuth client is not configured');
    const response = await timedFetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: client.client_id, client_secret: client.client_secret, redirect_uri: this.config.getOrThrow<string>('GOOGLE_OAUTH_REDIRECT_URI'), grant_type: 'authorization_code' }),
    });
    if (!response.ok) throw new ConflictException(`Google OAuth token exchange failed (${response.status})`);
    const token = await response.json() as { refresh_token?: string };
    if (!token.refresh_token) throw new ConflictException('Google OAuth did not return a refresh token');
    try {
      writeFileSync(this.config.getOrThrow<string>('GOOGLE_OAUTH_TOKEN_FILE'), JSON.stringify({ refresh_token: token.refresh_token }, null, 2), { mode: 0o600 });
    } catch (error) {
      // Serverless filesystems are read-only; the token must then be stored as
      // the GOOGLE_OAUTH_REFRESH_TOKEN secret instead. Never log its value.
      this.logger.error(`Could not persist Google refresh token: ${error instanceof Error ? error.message : String(error)}`);
      throw new ConflictException('Google authorized, but the refresh token could not be stored. Set GOOGLE_OAUTH_REFRESH_TOKEN in the deployment secrets.');
    }
  }

  private googleConfigured() {
    return Boolean(this.config.get('GOOGLE_CALENDAR_ID') && (this.oauthRefreshToken() || this.googleCredentials()));
  }

  private oauthClient(): { client_id: string; client_secret: string } | null {
    const filePath = this.config.get<string>('GOOGLE_OAUTH_CLIENT_FILE');
    const configuredClientId = this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID');
    const configuredClientSecret = this.config.get<string>('GOOGLE_OAUTH_CLIENT_SECRET');
    if (!filePath) {
      return configuredClientId && configuredClientSecret ? { client_id: configuredClientId, client_secret: configuredClientSecret } : null;
    }
    try {
      const json = JSON.parse(readFileSync(filePath, 'utf8')) as { web?: { client_id?: string; client_secret?: string }; installed?: { client_id?: string; client_secret?: string } };
      const client = json.web || json.installed;
      return client?.client_id && client.client_secret
        ? { client_id: client.client_id, client_secret: client.client_secret }
        : configuredClientId && configuredClientSecret
          ? { client_id: configuredClientId, client_secret: configuredClientSecret }
          : null;
    } catch (error) {
      this.logger.error(`Could not read Google OAuth client file: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  private oauthRefreshToken(): string | null {
    const configuredToken = this.config.get<string>('GOOGLE_OAUTH_REFRESH_TOKEN');
    if (configuredToken) return configuredToken;
    const filePath = this.config.getOrThrow<string>('GOOGLE_OAUTH_TOKEN_FILE');
    try {
      if (!existsSync(filePath)) return null;
      const token = JSON.parse(readFileSync(filePath, 'utf8')) as { refresh_token?: string };
      return token.refresh_token || null;
    } catch {
      return null;
    }
  }

  private googleCredentials(): { email: string; privateKey: string } | null {
    const keyFile = this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_KEY_FILE');
    try {
      const file = keyFile ? JSON.parse(readFileSync(keyFile, 'utf8')) as { client_email?: string; private_key?: string } : null;
      const email = file?.client_email || this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL');
      const privateKey = file?.private_key || this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
      return email && privateKey ? { email, privateKey: privateKey.replaceAll('\\n', '\n') } : null;
    } catch (error) {
      this.logger.error(`Could not read Google service account key file: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  private async googleAccessToken(): Promise<string> {
    const oauthClient = this.oauthClient();
    const refreshToken = this.oauthRefreshToken();
    if (oauthClient && refreshToken) {
      const response = await timedFetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: oauthClient.client_id, client_secret: oauthClient.client_secret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
      });
      if (!response.ok) throw new Error(`Google OAuth refresh failed (${response.status})`);
      const data = await response.json() as { access_token?: string };
      if (!data.access_token) throw new Error('Google OAuth refresh did not return an access token');
      return data.access_token;
    }
    const credentials = this.googleCredentials();
    if (!credentials) throw new Error('Google service account credentials are not configured');
    const { email, privateKey } = credentials;
    const now = Math.floor(Date.now() / 1000);
    const header = encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = encode(JSON.stringify({ iss: email, scope: 'https://www.googleapis.com/auth/calendar', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
    const unsigned = `${header}.${payload}`;
    const signature = createSign('RSA-SHA256').update(unsigned).sign(privateKey, 'base64url');
    const response = await timedFetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
    });
    if (!response.ok) throw new Error(`Google OAuth failed (${response.status})`);
    const data = await response.json() as { access_token?: string };
    if (!data.access_token) throw new Error('Google OAuth did not return an access token');
    return data.access_token;
  }

  private async createCalendarEvent(appointment: Appointment): Promise<CalendarResult> {
    const token = await this.googleAccessToken();
    const calendarId = encodeURIComponent(this.config.getOrThrow<string>('GOOGLE_CALENDAR_ID'));
    const response = await timedFetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?conferenceDataVersion=1&sendUpdates=all`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: `BIM4C consultation: ${appointment.topic}`,
        description: appointment.message || 'Consultation booked via BIM4C website.',
        start: { dateTime: appointment.startAt.toISOString(), timeZone: appointment.timezone },
        end: { dateTime: appointment.endAt.toISOString(), timeZone: appointment.timezone },
        // Let Google Calendar choose the conference solution allowed for this calendar.
        // Hard-coding hangoutsMeet can return "Invalid conference type value" for
        // calendars whose allowedConferenceSolutionTypes are not exposed to the service account.
        conferenceData: { createRequest: { requestId: randomUUID() } },
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      let detail = body;
      try {
        const parsed = JSON.parse(body) as { error?: { message?: string } };
        detail = parsed.error?.message || body;
      } catch {
        // Keep the raw response when Google does not return JSON.
      }
      throw new Error(`Google Calendar event creation failed (${response.status}): ${detail.slice(0, 500)}`);
    }
    const event = await response.json() as CalendarResult;
    if (this.meetingUrl(event)) return event;

    // Google creates conference data asynchronously. Poll the event briefly so
    // the confirmation email contains the actual Meet URL instead of a pending request.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const refreshed = await timedFetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(event.id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!refreshed.ok) continue;
      const current = await refreshed.json() as CalendarResult;
      if (this.meetingUrl(current)) return current;
    }
    try {
      await timedFetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(event.id)}?sendUpdates=all`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      this.logger.error(`Could not clean up Calendar event without Meet: ${error instanceof Error ? error.message : String(error)}`);
    }
    throw new ConflictException('Google Calendar event was created but this account cannot generate Google Meet. Use Google OAuth user authorization or Google Workspace domain-wide delegation.');
  }

  private meetingUrl(event: CalendarResult) {
    return event.hangoutLink || event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video')?.uri || null;
  }

  /** Email that must not block the calling workflow (e.g. a confirmation). */
  private async trySendEmail(input: { to?: string; subject: string; html: string }) {
    try {
      await this.sendEmail(input);
    } catch (error) {
      this.logger.error(`Email "${input.subject}" failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async sendEmail(input: { to?: string; subject: string; html: string }) {
    if (!input.to || this.config.get('EMAIL_PROVIDER') !== 'resend' || !this.config.get('RESEND_API_KEY')) {
      this.logger.warn(`Email skipped for ${input.subject}: email provider is not configured`);
      return;
    }
    const response = await timedFetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${this.config.getOrThrow<string>('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.config.getOrThrow<string>('MAIL_FROM'), to: [input.to], subject: input.subject, html: input.html }),
    });
    if (!response.ok) throw new Error(`Email delivery failed (${response.status})`);
  }

  private date(appointment: Appointment) {
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full', timeStyle: 'short', timeZone: appointment.timezone }).format(appointment.startAt);
  }
  private customerRequestEmail(a: Appointment) { return `<p>Xin chào ${escapeHtml(a.name)},</p><p>BIM4C đã nhận yêu cầu tư vấn của bạn.</p><p><b>Chủ đề:</b> ${escapeHtml(a.topic)}<br><b>Thời gian mong muốn:</b> ${escapeHtml(this.date(a))}</p><p>Đội ngũ BIM4C sẽ xác nhận lịch và gửi link Google Meet sau.</p>`; }
  private adminRequestEmail(a: Appointment) { return `<p>Có yêu cầu tư vấn mới từ website BIM4C.</p><p><b>Khách hàng:</b> ${escapeHtml(a.name)} (${escapeHtml(a.email)})<br><b>Chủ đề:</b> ${escapeHtml(a.topic)}<br><b>Thời gian:</b> ${escapeHtml(this.date(a))}<br><b>Điện thoại:</b> ${escapeHtml(a.phone)}<br><b>Công ty:</b> ${escapeHtml(a.company)}</p>`; }
  private customerConfirmedEmail(a: Appointment) { return `<p>Xin chào ${escapeHtml(a.name)},</p><p>Lịch tư vấn BIM4C của bạn đã được xác nhận.</p><p><b>Thời gian:</b> ${escapeHtml(this.date(a))}</p>${a.meetingUrl ? `<p><a href="${escapeHtml(a.meetingUrl)}">Tham gia Google Meet</a></p>` : '<p>BIM4C sẽ liên hệ trực tiếp theo thông tin đăng ký.</p>'}`; }
  private adminConfirmedEmail(a: Appointment) { return `<p>Lịch tư vấn đã được xác nhận cho ${escapeHtml(a.name)} (${escapeHtml(a.email)}).</p><p>${escapeHtml(this.date(a))}${a.meetingUrl ? ` · <a href="${escapeHtml(a.meetingUrl)}">Google Meet</a>` : ''}</p>`; }
  private customerCancelledEmail(a: Appointment) { return `<p>Xin chào ${escapeHtml(a.name)},</p><p>Lịch tư vấn BIM4C vào ${escapeHtml(this.date(a))} đã được hủy. Vui lòng liên hệ lại nếu bạn muốn đặt lịch mới.</p>`; }
}
