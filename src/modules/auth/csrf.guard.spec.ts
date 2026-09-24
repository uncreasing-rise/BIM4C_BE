import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';

const context = (request: object) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

function guardFor(env: Record<string, string>) {
  return new CsrfGuard({ get: (key: string) => env[key] } as never);
}

const cookie = { bim4c_admin_session: 'session-token' };
const production = {
  NODE_ENV: 'production',
  CORS_ORIGINS: 'https://www.bim4c.vn,https://bim4c.vn',
};

describe('CsrfGuard', () => {
  it('lets safe methods through', () => {
    const guard = guardFor(production);
    expect(
      guard.canActivate(context({ method: 'GET', headers: {}, cookies: cookie })),
    ).toBe(true);
  });

  it('accepts cookie mutations from a configured origin', () => {
    const guard = guardFor(production);
    const request = {
      method: 'POST',
      headers: { origin: 'https://www.bim4c.vn' },
      cookies: cookie,
    };
    expect(guard.canActivate(context(request))).toBe(true);
  });

  it.each([
    'https://evil.example',
    'https://attacker.vercel.app',
    'https://www.bim4c.vn.evil.example',
    'http://localhost:3000',
  ])('rejects cookie mutations from %s in production', (origin) => {
    const guard = guardFor(production);
    const request = { method: 'PATCH', headers: { origin }, cookies: cookie };
    expect(() => guard.canActivate(context(request))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects cookie mutations without Origin or Referer in production', () => {
    const guard = guardFor(production);
    const request = { method: 'DELETE', headers: {}, cookies: cookie };
    expect(() => guard.canActivate(context(request))).toThrow(
      ForbiddenException,
    );
  });

  it('falls back to the Referer origin', () => {
    const guard = guardFor(production);
    const request = {
      method: 'POST',
      headers: { referer: 'https://bim4c.vn/admin/du-an?x=1' },
      cookies: cookie,
    };
    expect(guard.canActivate(context(request))).toBe(true);
  });

  it('exempts bearer-only requests, which browsers cannot forge', () => {
    const guard = guardFor(production);
    const request = {
      method: 'POST',
      headers: { authorization: 'Bearer abc', origin: 'https://evil.example' },
      cookies: {},
    };
    expect(guard.canActivate(context(request))).toBe(true);
  });

  it('still checks origin when a cookie accompanies a bearer token', () => {
    const guard = guardFor(production);
    const request = {
      method: 'POST',
      headers: { authorization: 'Bearer abc', origin: 'https://evil.example' },
      cookies: cookie,
    };
    expect(() => guard.canActivate(context(request))).toThrow(
      ForbiddenException,
    );
  });

  it('allows localhost only outside production', () => {
    const guard = guardFor({ NODE_ENV: 'development' });
    const request = {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
      cookies: cookie,
    };
    expect(guard.canActivate(context(request))).toBe(true);
  });
});
