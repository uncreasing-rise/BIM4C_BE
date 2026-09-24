import { BadRequestException } from '@nestjs/common';
import { AppointmentNotificationsService } from './appointment-notifications.service';

function service() {
  const env: Record<string, string> = {
    OAUTH_STATE_SECRET: 'x'.repeat(40),
    GOOGLE_OAUTH_CLIENT_ID: 'client-id-with-enough-length.apps',
    GOOGLE_OAUTH_CLIENT_SECRET: 'client-secret',
    GOOGLE_OAUTH_REDIRECT_URI: 'https://api.example/callback',
  };
  const config = {
    get: (key: string) => env[key],
    getOrThrow: (key: string) => env[key],
  };
  return new AppointmentNotificationsService(config as never, {} as never);
}

const stateOf = (url: string) => new URL(url).searchParams.get('state')!;

describe('Google OAuth state', () => {
  it('binds the authorization URL to the admin session', () => {
    const url = service().googleAuthorizationUrl('session-a');
    expect(stateOf(url)).toMatch(/^\d+\.[\w-]+$/);
  });

  it('rejects a callback whose state belongs to another session', async () => {
    const notifications = service();
    const state = stateOf(notifications.googleAuthorizationUrl('session-a'));
    await expect(
      notifications.completeGoogleAuthorization('code', state, 'session-b'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a missing or tampered state', async () => {
    const notifications = service();
    await expect(
      notifications.completeGoogleAuthorization('code', undefined, 'session-a'),
    ).rejects.toBeInstanceOf(BadRequestException);
    const state = stateOf(notifications.googleAuthorizationUrl('session-a'));
    const tampered = `${Number(state.split('.')[0]) + 1}.${state.split('.')[1]}`;
    await expect(
      notifications.completeGoogleAuthorization('code', tampered, 'session-a'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
