import { UnauthorizedException } from '@nestjs/common';
import { hashSync } from 'bcryptjs';
import { AuthService } from './auth.service';
import { permissionsFor } from './permissions';

describe('production admin auth and RBAC', () => {
  const user = {
    id: 'u1',
    email: 'admin@example.com',
    name: 'Admin',
    status: 'ACTIVE',
    passwordHash: hashSync('valid-password-123', 4),
    roles: [{ role: 'SUPER_ADMIN' }],
  };
  const tx = {
    adminSession: {
      deleteMany: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 's1' }),
    },
    adminUser: { update: jest.fn() },
  };
  const prisma = {
    adminUser: { findUnique: jest.fn().mockResolvedValue(user) },
    adminSession: { deleteMany: jest.fn() },
    $transaction: jest.fn((fn: (x: typeof tx) => unknown) => fn(tx)),
  };
  const config = {
    get: jest.fn((key: string) =>
      key === 'AUTH_SESSION_TTL_HOURS' ? 8 : undefined,
    ),
  };
  const audit = { record: jest.fn() };
  const service = new AuthService(
    prisma as never,
    config as never,
    audit as never,
  );
  beforeEach(() => jest.clearAllMocks());
  it('logs in with a hashed password and creates an auditable session', async () => {
    const result = await service.login(
      { email: user.email, password: 'valid-password-123' },
      'request-1',
    );
    expect(result.token.length).toBeGreaterThan(32);
    expect(tx.adminSession.create).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalled();
  });
  it('rejects an invalid password', async () => {
    await expect(
      service.login({ email: user.email, password: 'wrong-password' }, 'r'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('rejects a disabled user', async () => {
    prisma.adminUser.findUnique.mockResolvedValueOnce({
      ...user,
      status: 'DISABLED',
    });
    await expect(
      service.login({ email: user.email, password: 'valid-password-123' }, 'r'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('destroys the server-side session on logout', async () => {
    await service.logout('s1', 'u1', 'r');
    expect(prisma.adminSession.deleteMany).toHaveBeenCalledWith({
      where: { id: 's1', userId: 'u1' },
    });
  });
  it('grants editor content permissions but no user or audit permission', () => {
    const p = permissionsFor(['EDITOR']);
    expect(p).toContain('projects.create');
    expect(p).not.toContain('users.read');
    expect(p).not.toContain('audit.read');
  });
  it('grants super admin every permission', () =>
    expect(permissionsFor(['SUPER_ADMIN'])).toEqual(['*']));
});
