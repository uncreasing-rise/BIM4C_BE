import { NotFoundException } from '@nestjs/common';
import { PageContentService } from './page-content.service';

describe('PageContentService', () => {
  const row = {
    key: 'home.hero',
    vi: { title: 'Xin chào' },
    en: { title: 'Hello' },
  };

  it('returns public content keyed by block and caches it', async () => {
    const prisma = {
      pageContent: { findMany: jest.fn().mockResolvedValue([row]) },
    };
    const service = new PageContentService(prisma as never);
    await expect(service.public()).resolves.toEqual({
      'home.hero': { vi: row.vi, en: row.en },
    });
    await service.public();
    expect(prisma.pageContent.findMany).toHaveBeenCalledTimes(1);
  });

  it('publishes the team by role and expertise only, never names or photos', async () => {
    const member = {
      name: 'Nguyễn Văn A',
      role: 'CEO',
      spec: '15 năm BIM',
      image: '/a.jpg',
    };
    const about = {
      key: 'about',
      vi: { teamTitle: 'Đội ngũ', teamMembers: [member] },
      en: { teamMembers: [member] },
    };
    const prisma = {
      pageContent: { findMany: jest.fn().mockResolvedValue([about, row]) },
    };
    const service = new PageContentService(prisma as never);
    const data = await service.public();
    expect(data.about.vi).toEqual({
      teamTitle: 'Đội ngũ',
      teamMembers: [{ role: 'CEO', spec: '15 năm BIM' }],
    });
    expect(data.about.en).toEqual({
      teamMembers: [{ role: 'CEO', spec: '15 năm BIM' }],
    });
    expect(JSON.stringify(data)).not.toContain('Nguyễn Văn A');
    expect(data['home.hero']).toEqual({ vi: row.vi, en: row.en });
    // Admins still see and edit the full records.
    await expect(service.list()).resolves.toEqual([about, row]);
  });

  it('returns an empty map when every block was deleted', async () => {
    const prisma = {
      pageContent: { findMany: jest.fn().mockResolvedValue([]) },
    };
    await expect(
      new PageContentService(prisma as never).public(),
    ).resolves.toEqual({});
  });

  it('upserts a known block and clears the public cache', async () => {
    const prisma = {
      pageContent: {
        findMany: jest.fn().mockResolvedValue([row]),
        upsert: jest.fn().mockResolvedValue(row),
      },
    };
    const service = new PageContentService(prisma as never);
    await service.public();
    await service.update('home.hero', { vi: row.vi, en: row.en });
    expect(prisma.pageContent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'home.hero' },
        create: { key: 'home.hero', vi: row.vi, en: row.en },
      }),
    );
    await service.public();
    expect(prisma.pageContent.findMany).toHaveBeenCalledTimes(2);
  });

  it('rejects unknown blocks', async () => {
    const prisma = { pageContent: { upsert: jest.fn() } };
    await expect(
      new PageContentService(prisma as never).update('random', {
        vi: {},
        en: {},
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.pageContent.upsert).not.toHaveBeenCalled();
  });
});
