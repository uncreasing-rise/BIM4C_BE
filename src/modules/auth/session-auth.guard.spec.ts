import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { PermissionGuard } from './permission.guard';
import { SessionAuthGuard, invalidateSessionCache } from './session-auth.guard';

const token = 'valid-session-token-with-at-least-thirty-two-characters';
const request = (cookie?: string) => ({
  headers: {} as Record<string, string>,
  cookies: cookie ? { bim4c_admin_session: cookie } : {},
  method: 'GET',
  path: '/admin/users',
});
const context = (value: ReturnType<typeof request>) =>
  ({
    switchToHttp: () => ({ getRequest: () => value }),
    getHandler: () => null,
    getClass: () => null,
  }) as unknown as ExecutionContext;

describe('session guard security states', () => {
  const config = { get: jest.fn(() => 'bim4c_admin_session') };
  const prisma = { adminSession: { findUnique: jest.fn() } };
  const guard = new SessionAuthGuard(prisma as never, config as never);

  beforeEach(() => {
    jest.clearAllMocks();
    invalidateSessionCache();
  });

  it('rejects a missing cookie', async () => {
    await expect(guard.canActivate(context(request()))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a random cookie', async () => {
    prisma.adminSession.findUnique.mockResolvedValueOnce(null);
    await expect(
      guard.canActivate(context(request(token))),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an expired session', async () => {
    prisma.adminSession.findUnique.mockResolvedValueOnce({
      expiresAt: new Date(0),
      user: { status: 'ACTIVE', roles: [] },
    });
    await expect(
      guard.canActivate(context(request(token))),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a disabled user', async () => {
    prisma.adminSession.findUnique.mockResolvedValueOnce({
      expiresAt: new Date('2099-01-01'),
      user: { status: 'DISABLED', roles: [] },
    });
    await expect(
      guard.canActivate(context(request(token))),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('loads current roles for every request', async () => {
    prisma.adminSession.findUnique.mockResolvedValueOnce({
      id: 'session-id',
      expiresAt: new Date('2099-01-01'),
      user: {
        id: 'user-id',
        email: 'editor@example.com',
        name: 'Editor',
        status: 'ACTIVE',
        roles: [{ role: 'EDITOR' }],
      },
    });
    const req = request(token);
    await expect(guard.canActivate(context(req))).resolves.toBe(true);
    expect(
      (req as typeof req & { admin: { roles: string[] } }).admin.roles,
    ).toEqual(['EDITOR']);
  });
});

describe('permission guard after role removal', () => {
  it('returns 403 when the current session has no required permission', () => {
    const reflector = { getAllAndOverride: jest.fn(() => 'users'), get: jest.fn(() => undefined) };
    const guard = new PermissionGuard(reflector as never);
    const req = Object.assign(request(token), {
      admin: { permissions: [], roles: [], id: 'user-id' },
    });
    expect(() => guard.canActivate(context(req))).toThrow(ForbiddenException);
  });
  it('checks the action a route declares instead of the HTTP method', () => {
    const reflector = { getAllAndOverride: jest.fn(() => 'posts'), get: jest.fn(() => 'publish') };
    const guard = new PermissionGuard(reflector as never);
    const editor = Object.assign(request(token), {
      method: 'POST',
      path: '/admin/posts/1/approve',
      admin: { permissions: ['posts.create', 'posts.update'], roles: ['EDITOR'], id: 'e' },
    });
    expect(() => guard.canActivate(context(editor))).toThrow(ForbiddenException);
    const admin = Object.assign(request(token), { ...editor, admin: { permissions: ['*'], roles: ['ADMIN'], id: 'a' } });
    expect(guard.canActivate(context(admin))).toBe(true);
  });
});
