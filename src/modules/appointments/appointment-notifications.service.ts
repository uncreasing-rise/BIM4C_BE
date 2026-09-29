import { EmailService } from '../email/email.service';
import {
  appointmentEmail,
  type AppointmentEmailKind,
} from './appointment-email';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHmac,
  createSign,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { Appointment } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

type CalendarResult = {
  id: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: { entryPointType?: string; uri?: string }[];
  };
};

const encode = (value: string) => Buffer.from(value).toString('base64url');
const OUTBOUND_TIMEOUT_MS = 10_000;
const OAUTH_STATE_TTL_MS = 10 * 60_000;
/** Google and Resend calls run inside admin requests; never let them hang. */
const timedFetch = (url: string, init: RequestInit = {}) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS) });
@Injectable()
export class AppointmentNotificationsService {
  private readonly logger = new Logger(AppointmentNotificationsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  notifyRequested(appointment: Appointment) {
    return this.notify(appointment, 'requested');
  }

  async confirm(appointment: Appointment): Promise<Appointment> {
    if (appointment.calendarEventId) return appointment;
    if (!(await this.googleConfigured())) {
      this.logger.warn(
        'Google Calendar is not configured; confirming without a Meet link',
      );
      return appointment;
    }
    const calendar = await this.createCalendarEvent(appointment);
    return this.prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        calendarEventId: calendar.id,
        meetingUrl: this.meetingUrl(calendar),
      },
    });
  }

  async cancel(appointment: Appointment) {
    if (appointment.calendarEventId && (await this.googleConfigured())) {
      try {
        const token = await this.googleAccessToken();
        const calendarId = encodeURIComponent(
          this.config.getOrThrow<string>('GOOGLE_CALENDAR_ID'),
        );
        await timedFetch(
          `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(appointment.calendarEventId)}?sendUpdates=all`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      } catch (error) {
        this.logger.error(
          `Could not cancel Google Calendar event: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return this.notify(appointment, 'cancelled');
  }

  /**
   * Signed OAuth `state` bound to the admin session that started the flow, so a
   * callback cannot be replayed from another browser (OAuth login CSRF). It is
   * stateless on purpose: serverless instances share no memory.
   */
  private oauthState(sessionId: string, expiresAt: number): string {
    const secret =
      this.config.get<string>('OAUTH_STATE_SECRET') ??
      this.config.get<string>('REVALIDATION_SECRET') ??
      'bim4c_oauth_default_state_hmac_secret_2026';
    const signature = createHmac('sha256', secret)
      .update(`${sessionId}.${expiresAt}`)
      .digest('base64url');
    return `${sessionId}.${expiresAt}.${signature}`;
  }

  private verifyOauthState(state: string | undefined): string {
    const parts = (state ?? '').split('.');
    if (parts.length !== 3)
      throw new BadRequestException('Invalid or expired OAuth state');
    const [sessionId, expires, signature] = parts;
    const expiresAt = Number(expires);
    if (
      !sessionId ||
      !signature ||
      !Number.isFinite(expiresAt) ||
      expiresAt < Date.now()
    )
      throw new BadRequestException('Invalid or expired OAuth state');
    const secret =
      this.config.get<string>('OAUTH_STATE_SECRET') ??
      this.config.get<string>('REVALIDATION_SECRET') ??
      'bim4c_oauth_default_state_hmac_secret_2026';
    const expected = Buffer.from(
      createHmac('sha256', secret)
        .update(`${sessionId}.${expiresAt}`)
        .digest('base64url'),
    );
    const received = Buffer.from(signature);
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    )
      throw new BadRequestException('Invalid or expired OAuth state');
    return sessionId;
  }

  private redirectUri(): string {
    return (
      this.config.get<string>('GOOGLE_REDIRECT_URI') ??
      this.config.get<string>('GOOGLE_OAUTH_REDIRECT_URI') ??
      'https://api.bim4c.vn/admin/appointments/google/callback'
    );
  }

  async isGoogleConnected(): Promise<boolean> {
    const refreshToken = await this.oauthRefreshToken();
    return Boolean(refreshToken);
  }

  googleAuthorizationUrl(sessionId: string): string {
    const client = this.oauthClient();
    if (!client)
      throw new ConflictException('Google OAuth client is not configured');
    const params = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      state: this.oauthState(sessionId, Date.now() + OAUTH_STATE_TTL_MS),
      scope:
        'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/meetings.space.created',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async completeGoogleAuthorization(
    code: string | undefined,
    state: string | undefined,
  ): Promise<void> {
    this.verifyOauthState(state);
    if (!code) throw new BadRequestException('Missing authorization code');
    const client = this.oauthClient();
    if (!client)
      throw new ConflictException('Google OAuth client is not configured');
    const response = await timedFetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: client.client_id,
        client_secret: client.client_secret,
        redirect_uri: this.redirectUri(),
        grant_type: 'authorization_code',
      }),
    });
    if (!response.ok)
      throw new ConflictException(
        `Google OAuth token exchange failed (${response.status})`,
      );
    const token = (await response.json()) as {
      refresh_token?: string;
      scope?: string;
      token_type?: string;
    };
    if (token.refresh_token) {
      await this.prisma.googleOAuthToken.upsert({
        where: { id: 'default' },
        create: {
          id: 'default',
          refreshToken: token.refresh_token,
          scope: token.scope ?? null,
          tokenType: token.token_type ?? null,
        },
        update: {
          refreshToken: token.refresh_token,
          scope: token.scope ?? undefined,
          tokenType: token.token_type ?? undefined,
        },
      });
      this.logger.log('Google OAuth refresh token successfully stored in database');
    } else {
      const existing = await this.prisma.googleOAuthToken.findUnique({
        where: { id: 'default' },
      });
      if (!existing) {
        throw new ConflictException(
          'Google OAuth did not return a refresh token. Please re-authenticate and consent to offline access.',
        );
      }
      if (token.scope || token.token_type) {
        await this.prisma.googleOAuthToken.update({
          where: { id: 'default' },
          data: {
            scope: token.scope ?? existing.scope,
            tokenType: token.token_type ?? existing.tokenType,
          },
        });
      }
      this.logger.log(
        'Google OAuth authorization refreshed (retained existing refresh token in database)',
      );
    }
  }

  private async googleConfigured(): Promise<boolean> {
    const calendarId = this.config.get('GOOGLE_CALENDAR_ID');
    if (!calendarId) return false;
    const refreshToken = await this.oauthRefreshToken();
    if (refreshToken) return true;
    return Boolean(this.googleCredentials());
  }

  private oauthClient(): { client_id: string; client_secret: string } | null {
    const filePath = this.config.get<string>('GOOGLE_OAUTH_CLIENT_FILE');
    const configuredClientId =
      this.config.get<string>('GOOGLE_CLIENT_ID') ??
      this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID');
    const configuredClientSecret =
      this.config.get<string>('GOOGLE_CLIENT_SECRET') ??
      this.config.get<string>('GOOGLE_OAUTH_CLIENT_SECRET');
    if (!filePath) {
      return configuredClientId && configuredClientSecret
        ? {
            client_id: configuredClientId,
            client_secret: configuredClientSecret,
          }
        : null;
    }
    try {
      if (!existsSync(filePath)) {
        return configuredClientId && configuredClientSecret
          ? {
              client_id: configuredClientId,
              client_secret: configuredClientSecret,
            }
          : null;
      }
      const json = JSON.parse(readFileSync(filePath, 'utf8')) as {
        web?: { client_id?: string; client_secret?: string };
        installed?: { client_id?: string; client_secret?: string };
      };
      const client = json.web || json.installed;
      return client?.client_id && client.client_secret
        ? { client_id: client.client_id, client_secret: client.client_secret }
        : configuredClientId && configuredClientSecret
          ? {
              client_id: configuredClientId,
              client_secret: configuredClientSecret,
            }
          : null;
    } catch (error) {
      this.logger.error(
        `Could not read Google OAuth client file: ${error instanceof Error ? error.message : String(error)}`,
      );
      return configuredClientId && configuredClientSecret
        ? {
            client_id: configuredClientId,
            client_secret: configuredClientSecret,
          }
        : null;
    }
  }

  private async oauthRefreshToken(): Promise<string | null> {
    try {
      const record = await this.prisma.googleOAuthToken.findUnique({
        where: { id: 'default' },
      });
      return record?.refreshToken ?? null;
    } catch (error) {
      this.logger.error(
        `Could not fetch Google OAuth token from database: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private googleCredentials(): { email: string; privateKey: string } | null {
    const keyFile = this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_KEY_FILE');
    try {
      const file = keyFile
        ? (JSON.parse(readFileSync(keyFile, 'utf8')) as {
            client_email?: string;
            private_key?: string;
          })
        : null;
      const email =
        file?.client_email ||
        this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL');
      const privateKey =
        file?.private_key ||
        this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
      return email && privateKey
        ? { email, privateKey: privateKey.replaceAll('\\n', '\n') }
        : null;
    } catch (error) {
      this.logger.error(
        `Could not read Google service account key file: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async googleAccessToken(): Promise<string> {
    const oauthClient = this.oauthClient();
    const refreshToken = await this.oauthRefreshToken();
    if (oauthClient && refreshToken) {
      const response = await timedFetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: oauthClient.client_id,
          client_secret: oauthClient.client_secret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });
      if (!response.ok) {
        // Only expose known error codes, never Google's raw response or credentials.
        const failure = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        const prefix = `Google OAuth refresh failed (${response.status})`;
        if (
          failure?.error === 'invalid_client' ||
          failure?.error === 'unauthorized_client'
        ) {
          throw new BadGatewayException(
            `${prefix}: ${failure.error}. Verify the configured Google OAuth client ID and secret and that the refresh token belongs to this client, then reconnect via /admin/appointments/google/connect.`,
          );
        }
        if (failure?.error === 'invalid_grant') {
          throw new BadGatewayException(
            `${prefix}: invalid_grant. Reconnect Google Calendar via /admin/appointments/google/connect.`,
          );
        }
        throw new BadGatewayException(
          `${prefix}. Google could not refresh the access token. Retry later; if the error persists, check the Google OAuth configuration.`,
        );
      }
      const data = (await response.json()) as { access_token?: string };
      if (!data.access_token)
        throw new Error('Google OAuth refresh did not return an access token');
      return data.access_token;
    }
    const credentials = this.googleCredentials();
    if (!credentials)
      throw new Error('Google service account credentials are not configured');

    const { email, privateKey } = credentials;
    const now = Math.floor(Date.now() / 1000);
    const header = encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = encode(
      JSON.stringify({
        iss: email,
        scope: 'https://www.googleapis.com/auth/calendar',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    );
    const unsigned = `${header}.${payload}`;
    const signature = createSign('RSA-SHA256')
      .update(unsigned)
      .sign(privateKey, 'base64url');
    const response = await timedFetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${unsigned}.${signature}`,
      }),
    });
    if (!response.ok)
      throw new BadGatewayException(`Google OAuth failed (${response.status})`);
    const data = (await response.json()) as { access_token?: string };
    if (!data.access_token)
      throw new Error('Google OAuth did not return an access token');
    return data.access_token;
  }

  private async createCalendarEvent(
    appointment: Appointment,
  ): Promise<CalendarResult> {
    const token = await this.googleAccessToken();
    const calendarId = encodeURIComponent(
      this.config.getOrThrow<string>('GOOGLE_CALENDAR_ID'),
    );
    const response = await timedFetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?conferenceDataVersion=1&sendUpdates=all`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: `BIM4C consultation: ${appointment.topic}`,
          description:
            appointment.message || 'Consultation booked via BIM4C website.',
          start: {
            dateTime: appointment.startAt.toISOString(),
            timeZone: appointment.timezone,
          },
          end: {
            dateTime: appointment.endAt.toISOString(),
            timeZone: appointment.timezone,
          },
          // Let Google Calendar choose the conference solution allowed for this calendar.
          // Hard-coding hangoutsMeet can return "Invalid conference type value" for
          // calendars whose allowedConferenceSolutionTypes are not exposed to the service account.
          conferenceData: { createRequest: { requestId: randomUUID() } },
        }),
      },
    );
    if (!response.ok) {
      const body = await response.text();
      let detail = body;
      try {
        const parsed = JSON.parse(body) as { error?: { message?: string } };
        detail = parsed.error?.message || body;
      } catch {
        // Keep the raw response when Google does not return JSON.
      }
      throw new BadGatewayException(
        `Google Calendar event creation failed (${response.status}): ${detail.slice(0, 500)}`,
      );
    }
    const event = (await response.json()) as CalendarResult;
    if (this.meetingUrl(event)) return event;

    // Google creates conference data asynchronously. Poll the event briefly so
    // the confirmation email contains the actual Meet URL instead of a pending request.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const refreshed = await timedFetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(event.id)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!refreshed.ok) continue;
      const current = (await refreshed.json()) as CalendarResult;
      if (this.meetingUrl(current)) return current;
    }
    try {
      await timedFetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(event.id)}?sendUpdates=all`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
    } catch (error) {
      this.logger.error(
        `Could not clean up Calendar event without Meet: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    throw new ConflictException(
      'Google Calendar event was created but this account cannot generate Google Meet. Use Google OAuth user authorization or Google Workspace domain-wide delegation.',
    );
  }

  private meetingUrl(event: CalendarResult) {
    return (
      event.hangoutLink ||
      event.conferenceData?.entryPoints?.find(
        (entry) => entry.entryPointType === 'video',
      )?.uri ||
      null
    );
  }

  async notify(a: Appointment, kind: AppointmentEmailKind) {
    const customerContent = appointmentEmail(
      a,
      kind,
      false,
      this.email.url('/'),
    );
    const adminContent = appointmentEmail(a, kind, true, this.email.url('/'));
    const [customer, admin] = await Promise.all([
      this.email.send({
        to: a.email,
        subject: customerContent.title + ' | BIM4C',
        key: 'appointment/' + a.id + '/' + kind + '/customer',
        content: customerContent,
      }),
      this.email.send({
        to: this.email.adminEmail,
        replyTo: a.email,
        subject: adminContent.title,
        key: 'appointment/' + a.id + '/' + kind + '/admin',
        content: adminContent,
      }),
    ]);
    return { customer, admin };
  }
}
