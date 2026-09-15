import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { syncCompanyProfile } from './sync-company-profile';
const prisma = new PrismaClient();
async function seed(): Promise<void> {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ADMIN_BOOTSTRAP_RESET_PASSWORD === 'true'
  ) {
    throw new Error(
      'ADMIN_BOOTSTRAP_RESET_PASSWORD must not be enabled in production',
    );
  }
  const bootstrapEmail =
    process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (bootstrapEmail && bootstrapPassword) {
    const existing = await prisma.adminUser.findUnique({
      where: { email: bootstrapEmail },
    });
    if (!existing)
      await prisma.adminUser.create({
        data: {
          email: bootstrapEmail,
          name: 'BIM4C Super Admin',
          passwordHash: await hash(bootstrapPassword, 12),
          roles: { create: [{ role: 'SUPER_ADMIN' }] },
        },
      });
    else if (process.env.ADMIN_BOOTSTRAP_RESET_PASSWORD === 'true')
      await prisma.$transaction([
        prisma.adminUser.update({
          where: { id: existing.id },
          data: { passwordHash: await hash(bootstrapPassword, 12) },
        }),
        prisma.adminSession.deleteMany({ where: { userId: existing.id } }),
      ]);
  }
  await syncCompanyProfile(prisma);
}
void seed().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Seed failed'); process.exitCode=1; }).finally(()=>prisma.$disconnect());
