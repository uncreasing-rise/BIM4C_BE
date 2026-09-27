/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- inspecting jest mock call arguments */
import { AdminListQueryDto } from './admin.dto';
import { AdminService, invalidateAdminCache } from './admin.service';

describe('AdminService list sorting and filters', () => {
  beforeEach(() => invalidateAdminCache());

  function setup() {
    const delegate = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    const prisma = { post: delegate, contact: delegate };
    const service = new AdminService(prisma as never, {} as never);
    return { delegate, service };
  }

  function query(values: Partial<AdminListQueryDto>) {
    return Object.assign(new AdminListQueryDto(), values);
  }

  it('splits news from technical posts and keeps the search', async () => {
    const { delegate, service } = setup();
    await service.list('post', query({ group: 'technical', search: 'revit' }));
    const { where } = delegate.findMany.mock.calls[0][0];
    expect(where.OR).toBeUndefined();
    expect(where.AND).toHaveLength(2);
    expect(where.AND[1].OR[0]).toEqual({ categoryId: null });
  });

  it('sorts by an allowed column with unique tiebreakers', async () => {
    const { delegate, service } = setup();
    await service.list('post', query({ sortBy: 'title', sortOrder: 'asc' }));
    expect(delegate.findMany.mock.calls[0][0].orderBy).toEqual([
      { title: 'asc' },
      { createdAt: 'desc' },
      { id: 'asc' },
    ]);
  });

  it('ignores columns outside the allowlist', async () => {
    const { delegate, service } = setup();
    await service.contacts(query({ sortBy: 'passwordHash', sortOrder: 'asc' }));
    expect(delegate.findMany.mock.calls[0][0].orderBy[0]).toEqual({
      createdAt: 'asc',
    });
  });
});
