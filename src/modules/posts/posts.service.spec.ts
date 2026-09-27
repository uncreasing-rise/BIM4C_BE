/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- inspecting jest mock call arguments */
import { clearPostsCache, PostsService } from './posts.service';

describe('PostsService.findAll', () => {
  beforeEach(() => clearPostsCache());

  function setup() {
    const prisma = {
      post: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    return { prisma, service: new PostsService(prisma as never) };
  }

  it('keeps the search filter when the technical group also needs an OR', async () => {
    const { prisma, service } = setup();
    await service.findAll({
      page: 1,
      limit: 6,
      search: 'revit',
      group: 'technical',
    });
    const { where } = prisma.post.findMany.mock.calls[0][0];
    expect(where.OR).toBeUndefined();
    expect(where.AND).toHaveLength(2);
    expect(JSON.stringify(where.AND[0])).toContain('revit');
    expect(where.AND[1].OR[0]).toEqual({ categoryId: null });
  });

  it('matches a category exactly and still applies the group', async () => {
    const { prisma, service } = setup();
    await service.findAll({
      page: 1,
      limit: 6,
      category: 'su-kien',
      group: 'news',
    });
    const { where } = prisma.post.findMany.mock.calls[0][0];
    expect(where.AND[0].category.OR).toEqual([
      { slug: { equals: 'su-kien', mode: 'insensitive' } },
      { name: { equals: 'su-kien', mode: 'insensitive' } },
    ]);
    expect(where.AND[1]).toEqual({
      category: { slug: { in: expect.any(Array) } },
    });
  });

  it('orders by a unique tiebreaker so pages never overlap', async () => {
    const { prisma, service } = setup();
    await service.findAll({ page: 2, limit: 6 });
    const args = prisma.post.findMany.mock.calls[0][0];
    expect(args.skip).toBe(6);
    expect(args.orderBy).toEqual([
      { publishedAt: { sort: 'desc', nulls: 'last' } },
      { createdAt: 'desc' },
      { id: 'asc' },
    ]);
  });
});
