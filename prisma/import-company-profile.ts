import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as profile from './data/company-profile.json';
import { syncCompanyProfile } from './sync-company-profile';

const prisma = new PrismaClient();
async function main() {
  const backup = {
    capturedAt: new Date().toISOString(), version: profile.version,
    projects: await prisma.project.findMany({ where: { slug: { in: [...profile.legacy.projects, ...profile.projects.map(x => x.slug)] } }, include: { images: true } }),
    services: await prisma.service.findMany({ where: { slug: { in: profile.services.map(x => x.slug) } } }),
    courses: await prisma.course.findMany({ where: { slug: { in: [...profile.legacy.courses, ...profile.courses.map(x => x.slug)] } } }),
    categories: await prisma.projectCategory.findMany(),
    posts: await prisma.post.findMany({ where: { slug: { in: profile.articles.map(x => x.slug) } } }),
    postCategories: await prisma.postCategory.findMany(),
    partners: await prisma.strategicPartner.findMany(), slides: await prisma.heroSlide.findMany(),
    settings: await prisma.siteSettings.findMany(),
  };
  console.log({ mode: process.argv.includes('--apply') ? 'apply' : 'preview', version: profile.version,
    incoming: { projects: profile.projects.length, services: profile.services.length, courses: profile.courses.length },
    existing: { projects: backup.projects.length, services: backup.services.length, courses: backup.courses.length } });
  if (!process.argv.includes('--apply')) return;
  const dir = resolve('.qa/profile-backups'); mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `before-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(backup, null, 2));
  console.log(`Backup: ${file}`);
  console.log(await syncCompanyProfile(prisma));
}
void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Profile import failed'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
