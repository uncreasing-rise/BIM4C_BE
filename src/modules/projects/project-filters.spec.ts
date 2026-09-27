import { ProjectStatus } from '@prisma/client';
import { clearProjectsCache, ProjectsService } from './projects.service';

describe('ProjectsService.filters', () => {
  beforeEach(() => clearProjectsCache());

  it('derives filter options from published projects only', async () => {
    const prisma = {
      projectCategory: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ slug: 'high-rise', name: 'High-rise' }]),
      },
      project: {
        findMany: jest.fn().mockResolvedValue([
          {
            location: 'Da Nang ',
            location_vi: 'Đà Nẵng',
            year: 2024,
            status: ProjectStatus.COMPLETED,
          },
          {
            location: 'Da Nang',
            location_vi: null,
            year: 2027,
            status: ProjectStatus.IN_PROGRESS,
          },
          {
            location: 'Ha Noi',
            location_vi: 'Hà Nội',
            year: null,
            status: ProjectStatus.COMPLETED,
          },
        ]),
      },
    };
    const filters = await new ProjectsService(prisma as never).filters();
    expect(filters).toEqual({
      categories: [{ slug: 'high-rise', name: 'High-rise' }],
      locations: [
        { value: 'Da Nang', label_vi: 'Đà Nẵng' },
        { value: 'Ha Noi', label_vi: 'Hà Nội' },
      ],
      years: [2027, 2024],
      statuses: ['in_progress', 'completed'],
    });
    const [{ where }] = prisma.project.findMany.mock.calls[0] as [
      { where: { deletedAt: null; status: { in: ProjectStatus[] } } },
    ];
    expect(where.deletedAt).toBeNull();
    expect(where.status.in).not.toContain(ProjectStatus.DRAFT);
  });

  it('returns empty options when there are no projects', async () => {
    const prisma = {
      projectCategory: { findMany: jest.fn().mockResolvedValue([]) },
      project: { findMany: jest.fn().mockResolvedValue([]) },
    };
    await expect(
      new ProjectsService(prisma as never).filters(),
    ).resolves.toEqual({
      categories: [],
      locations: [],
      years: [],
      statuses: [],
    });
  });
});
