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
