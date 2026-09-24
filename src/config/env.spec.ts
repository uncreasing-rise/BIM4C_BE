import { validateEnvironment } from './env';

const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' };

describe('validateEnvironment', () => {
  it('defaults the appointment timezone and cookie SameSite', () => {
    const env = validateEnvironment(base);
    expect(env.APPOINTMENT_TIMEZONE).toBe('Asia/Ho_Chi_Minh');
    expect(env.AUTH_COOKIE_SAME_SITE).toBe('lax');
  });

  it('rejects an unknown appointment timezone', () => {
    expect(() =>
      validateEnvironment({ ...base, APPOINTMENT_TIMEZONE: 'Mars/Olympus' }),
    ).toThrow(/APPOINTMENT_TIMEZONE/);
  });

  it('rejects SameSite=None outside production (it requires Secure)', () => {
    expect(() =>
      validateEnvironment({ ...base, AUTH_COOKIE_SAME_SITE: 'none' }),
    ).toThrow(/AUTH_COOKIE_SAME_SITE/);
  });
});
