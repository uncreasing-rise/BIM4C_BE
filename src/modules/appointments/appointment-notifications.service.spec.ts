import { BadRequestException } from '@nestjs/common';
import { AppointmentNotificationsService } from './appointment-notifications.service';

function service(
  overrides: Record<string, string> = {},
  mockToken: { refreshToken: string } | null = { refreshToken: 'test-token' },
) {
  const env: Record<string, string> = {
    OAUTH_STATE_SECRET: 'x'.repeat(40),
    GOOGLE_OAUTH_CLIENT_ID: 'client-id-with-enough-length.apps',
    GOOGLE_OAUTH_CLIENT_SECRET: 'client-secret',
    GOOGLE_OAUTH_REDIRECT_URI: 'https://api.example/callback',
    ...overrides,
  };
  const config = {
    get: (key: string) => env[key],
    getOrThrow: (key: string) => env[key],
  };
  const prisma = {
    googleOAuthToken: {
      findUnique: jest.fn().mockResolvedValue(mockToken),
      upsert: jest.fn().mockResolvedValue(mockToken),
      update: jest.fn().mockResolvedValue(mockToken),
    },
    appointment: {
      update: jest.fn(),
    },
  };
  return new AppointmentNotificationsService(
    config as never,
    prisma as never,
    {} as never,
  );
}

const stateOf = (url: string) => new URL(url).searchParams.get('state')!;

describe('Google OAuth state', () => {
  it('binds the authorization URL to the admin session', () => {
    const url = service().googleAuthorizationUrl('session-a');
    expect(stateOf(url)).toMatch(/^session-a\.\d+\.[\w-]+$/);
  });

  it('rejects a tampered session or signature in state', async () => {
    const notifications = service();
    const state = stateOf(notifications.googleAuthorizationUrl('session-a'));
    const parts = state.split('.');
    const tampered = `session-b.${parts[1]}.${parts[2]}`;
    await expect(
      notifications.completeGoogleAuthorization('code', tampered),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a missing or expired state', async () => {
    const notifications = service();
    await expect(
      notifications.completeGoogleAuthorization('code', undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
    const state = stateOf(notifications.googleAuthorizationUrl('session-a'));
    const parts = state.split('.');
    const tampered = `${parts[0]}.${Number(parts[1]) - 100000000}.${parts[2]}`;
    await expect(
      notifications.completeGoogleAuthorization('code', tampered),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Google OAuth refresh failures', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    [
      'unauthorized_client',
      401,
      'Verify the configured Google OAuth client ID and secret',
    ],
    [
      'invalid_client',
      401,
      'Verify the configured Google OAuth client ID and secret',
    ],
    ['invalid_grant', 400, 'Reconnect Google Calendar via /admin/appointments/google/connect'],
    ['server_error', 503, 'Retry later'],
  ])('provides recovery guidance for %s', async (error, status, guidance) => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error,
          error_description: 'sensitive upstream details',
        }),
        { status },
      ),
    );
    const notifications = service({
      GOOGLE_CALENDAR_ID: 'primary',
    });
    const result = notifications.confirm({ calendarEventId: null } as never);
    await expect(result).rejects.toThrow(guidance);
    await expect(result).rejects.not.toThrow('sensitive upstream details');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('handles a non-JSON upstream failure', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('upstream unavailable', { status: 502 }));
    const notifications = service({
      GOOGLE_CALENDAR_ID: 'primary',
    });
    await expect(
      notifications.confirm({ calendarEventId: null } as never),
    ).rejects.toThrow('Retry later');
  });
});
