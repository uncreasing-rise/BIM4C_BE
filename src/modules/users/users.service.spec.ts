import { ForbiddenException } from '@nestjs/common';
import type { AdminRole } from '@prisma/client';
import { UsersService, type UserActor } from './users.service';

const SUPER: UserActor = { id: 'super', roles: ['SUPER_ADMIN'], sessionId: 's-super' };
const ADMIN: UserActor = { id: 'admin', roles: ['ADMIN'], sessionId: 's-admin' };

function setup(targetRoles: AdminRole[] = ['EDITOR'], targetId = 'target') {
  const target = { id: targetId, roles: targetRoles.map((role) => ({ role })) };
  const prisma = {
    adminUser: {
      findUnique: jest.fn().mockResolvedValue(target),
      create: jest.fn().mockResolvedValue(target),
      update: jest.fn().mockResolvedValue(target),
      count: jest.fn().mockResolvedValue(2),
    },
    adminUserRole: { deleteMany: jest.fn(), createMany: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  return { service: new UsersService(prisma as never, audit as never), prisma };
}
const password = 'a-long-new-password';

describe('managing super admin accounts', () => {
  it('lets an admin manage editors and other admins', async () => {
    const { service } = setup(['ADMIN']);
    await expect(service.update('target', { name: 'X' }, ADMIN)).resolves.toBeDefined();
    await expect(service.status('target', 'DISABLED', ADMIN)).resolves.toBeDefined();
    await expect(service.roles('target', ['EDITOR'], ADMIN)).resolves.toBeDefined();
    await expect(
      service.create({ email: 'e@x.vn', name: 'E', password, roles: ['ADMIN'] }, ADMIN),
    ).resolves.toBeDefined();
  });

  it('stops an admin from creating or granting super admin, even to themselves', async () => {
    const { service, prisma } = setup(['ADMIN'], 'admin');
    await expect(
      service.create({ email: 's@x.vn', name: 'S', password, roles: ['SUPER_ADMIN'] }, ADMIN),
    ).rejects.toThrow(ForbiddenException);
    await expect(service.roles('admin', ['SUPER_ADMIN'], ADMIN)).rejects.toThrow(ForbiddenException);
    await expect(
      service.update('admin', { roles: ['ADMIN', 'SUPER_ADMIN'] }, ADMIN),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.adminUser.create).not.toHaveBeenCalled();
    expect(prisma.adminUser.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('stops an admin from editing, resetting, re-roling or disabling a super admin', async () => {
    const { service, prisma } = setup(['SUPER_ADMIN']);
    await expect(service.update('target', { password }, ADMIN)).rejects.toThrow(ForbiddenException);
    await expect(service.update('target', { name: 'X' }, ADMIN)).rejects.toThrow(ForbiddenException);
    await expect(service.roles('target', ['EDITOR'], ADMIN)).rejects.toThrow(ForbiddenException);
    await expect(service.status('target', 'DISABLED', ADMIN)).rejects.toThrow(ForbiddenException);
    expect(prisma.adminUser.update).not.toHaveBeenCalled();
  });

  it('lets a super admin do all of it', async () => {
    const { service } = setup(['SUPER_ADMIN']);
    await expect(service.update('target', { password }, SUPER)).resolves.toBeDefined();
    await expect(service.roles('target', ['SUPER_ADMIN', 'ADMIN'], SUPER)).resolves.toBeDefined();
    await expect(
      service.create({ email: 's@x.vn', name: 'S', password, roles: ['SUPER_ADMIN'] }, SUPER),
    ).resolves.toBeDefined();
  });
});

describe('password resets', () => {
  it("sign out every session of the account whose password was reset", async () => {
    const { service, prisma } = setup(['EDITOR']);
    await service.update('target', { password }, ADMIN);
    const [{ data }] = prisma.adminUser.update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(data.sessions).toEqual({ deleteMany: {} });
  });

  it('keep the session of an admin resetting their own password', async () => {
    const { service, prisma } = setup(['ADMIN'], 'admin');
    await service.update('admin', { password }, ADMIN);
    const [{ data }] = prisma.adminUser.update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(data.sessions).toEqual({ deleteMany: { id: { not: 's-admin' } } });
  });

  it('leave sessions alone when the password is unchanged', async () => {
    const { service, prisma } = setup(['EDITOR']);
    await service.update('target', { name: 'New name' }, ADMIN);
    const [{ data }] = prisma.adminUser.update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(data).not.toHaveProperty('sessions');
  });
});
