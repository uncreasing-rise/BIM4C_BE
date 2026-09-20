import { Prisma, PrismaClient, ContentStatus, ProjectStatus } from '@prisma/client';
import * as profile from './data/company-profile.json';

type Entry = (typeof profile.services)[number];
const blocks = (sections: Entry['sections']) => sections.flatMap((s, i) => [
  { id: `section-${i}`, type: 'rich-text', heading: s.title, content: s.body },
  ...('unorderedList' in s && s.unorderedList?.length ? [{ id: `list-${i}`, type: 'feature-list', items: s.unorderedList, ordered: false }] : []),
]);
const content = (x: Entry, sortOrder: number) => ({
  title: x.title, title_vi: x.title_vi, description: x.description, description_vi: x.description_vi,
  image: x.image, eyebrow: x.eyebrow, eyebrow_vi: x.eyebrow_vi,
  highlights: x.highlights, highlights_vi: x.highlights_vi,
  sections: x.sections, sections_vi: x.sections_vi,
  contentBlocks: blocks(x.sections), contentBlocks_vi: blocks(x.sections_vi),
  seoTitle: x.seoTitle, seoTitle_vi: x.seoTitle_vi,
  seoDescription: x.seoDescription, seoDescription_vi: x.seoDescription_vi,
  meta: null, meta_vi: null, seoImage: x.image,
  sortOrder, publishedAt: new Date('2026-09-15T00:00:00Z'), deletedAt: null,
});

/** Explicit, repeatable import. Archives known legacy samples, never deletes
 * registrations or unrelated editorial records. Back up before applying to an existing DB.
 */
export async function syncCompanyProfile(prisma: PrismaClient) {
  return prisma.$transaction(async tx => {
    await tx.project.updateMany({ where: { slug: { in: profile.legacy.projects } }, data: { status: ProjectStatus.ARCHIVED } });
    await tx.course.updateMany({ where: { slug: { in: profile.legacy.courses } }, data: { status: ContentStatus.ARCHIVED } });
    await tx.strategicPartner.updateMany({ where: { name: { in: profile.legacy.partners } }, data: { isActive: false } });
    await tx.heroSlide.updateMany({ where: { OR: [
      { image: { in: ['/images/hero.jpg', '/images/project-lumi.jpg', '/images/project-matrix.jpg'] } },
      { alt: { in: ['Dự án Lumi Hanoi', 'Ứng dụng BIM', 'Công trình BIM4C'] } },
    ] }, data: { isActive: false } });

    for (const [i, x] of profile.services.entries()) {
      const data = { ...content(x, i), status: ContentStatus.PUBLISHED };
      await tx.service.upsert({ where: { slug: x.slug }, create: { slug: x.slug, ...data }, update: data });
    }
    for (const [i, x] of profile.projects.entries()) {
      const category = await tx.projectCategory.upsert({ where: { slug: x.categorySlug }, create: { slug: x.categorySlug, name: x.category }, update: { name: x.category } });
      const data = { ...content(x, i), categoryId: category.id, location: x.location, location_vi: x.location_vi,
        year: null, status: ProjectStatus.PROFILED, isFeatured: i < 3,
        scale: x.scale, scale_vi: x.scale_vi,
        investor: x.investor ?? null, investor_vi: x.investor_vi ?? null,
        contractPackage: x.contractPackage ?? null, contractPackage_vi: x.contractPackage_vi ?? null,
        expectedCompletion: null, expectedCompletion_vi: null,
      };
      await tx.project.upsert({ where: { slug: x.slug }, create: { slug: x.slug, ...data }, update: data });
    }
    for (const [i, x] of profile.courses.entries()) {
      const data = { ...content(x, i), status: ContentStatus.PUBLISHED,
        duration: x.duration, duration_vi: x.duration_vi, level: x.level, level_vi: x.level_vi,
        price: x.price, price_vi: x.price_vi,
        instructor: null, instructor_vi: null,
      };
      await tx.course.upsert({ where: { slug: x.slug }, create: { slug: x.slug, ...data }, update: data });
    }
    for (const [sortOrder, x] of profile.partners.entries()) {
      const existing = await tx.strategicPartner.findFirst({ where: { name: x.name }, orderBy: { createdAt: 'asc' } });
      const data = { ...x, sortOrder, isActive: true };
      if (existing) await tx.strategicPartner.update({ where: { id: existing.id }, data });
      else await tx.strategicPartner.create({ data });
    }
    for (const [i, x] of profile.articles.entries()) {
      const catSlug = (x as { categorySlug?: string }).categorySlug || 'kien-thuc-bim';
      const catName = (x as { category?: string }).category || 'BIM Knowledge';
      const postCategory = await tx.postCategory.upsert({
        where: { slug: catSlug },
        create: { slug: catSlug, name: catName },
        update: { name: catName },
      });
      const data = {
        ...content(x as unknown as Entry, i),
        status: ContentStatus.PUBLISHED,
        authorName: (x as { authorName?: string }).authorName || 'BIM4C Specialist Team',
        categoryId: postCategory.id,
      };
      await tx.post.upsert({ where: { slug: x.slug }, create: { slug: x.slug, ...data }, update: data });
    }

    const settings = await tx.siteSettings.findUnique({ where: { id: 'default' } });
    // Preserve other settings; replace the known unsupported social examples.
    const links = settings?.socialLinks && typeof settings.socialLinks === 'object' && !Array.isArray(settings.socialLinks)
      ? { ...settings.socialLinks } : {};
    const sampleLinks = new Set(['https://zalo.me/02873004068','https://www.linkedin.com/company/bim4c','https://www.facebook.com/bim4c','https://www.youtube.com/@bim4c','https://github.com/bim4c']);
    for (const [key, value] of Object.entries(links)) if (typeof value === 'string' && sampleLinks.has(value)) delete links[key];
    const settingsData = { companyName: profile.contact.companyName.vi, email: profile.contact.email,
      phone: profile.contact.phoneDisplay, address: profile.contact.address.vi,
      socialLinks: links as Prisma.InputJsonObject,
    };
    await tx.siteSettings.upsert({ where: { id: 'default' }, update: settingsData, create: {
      ...settingsData, defaultSeoTitle: 'BIM4C — BIM, Design & Training',
      defaultSeoDescription: 'Laser scanning, BIM 3D–7D, design, construction consulting and training.',
      defaultOgImage: '/images/profile/hoa-xuan.webp',
    } });
    return { version: profile.version, projects: profile.projects.length, services: profile.services.length, courses: profile.courses.length };
  }, { timeout: 120000 });
}
