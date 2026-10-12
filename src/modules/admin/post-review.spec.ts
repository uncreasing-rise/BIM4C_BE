/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- inspecting jest mock call arguments */
import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { permissionsFor } from '../auth/permissions';
import { AdminService, invalidateAdminCache } from './admin.service';

const base = {
  id: 'p1',
  slug: 'bai-viet',
  title: 'Live title',
  status: 'PUBLISHED',
  publishedAt: new Date('2026-01-01T00:00:00Z'),
  draft: null as unknown,
  reviewStatus: 'NONE',
  deletedAt: null,
};

function setup(row: Partial<typeof base> = {}) {
  const post = {
    findFirst: jest.fn().mockResolvedValue({ ...base, ...row }),
    update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...base, ...row, ...data })),
  };
  const service = new AdminService({ post } as never, {} as never);
  return { post, service };
}

describe('post drafts and review', () => {
  beforeEach(() => invalidateAdminCache());

  it('editors may not publish posts; admins may', () => {
    expect(permissionsFor(['EDITOR'])).not.toContain('posts.publish');
    expect(permissionsFor(['EDITOR'])).toContain('posts.update');
    expect(permissionsFor(['EDITOR'])).toContain('projects.publish');
    expect(permissionsFor(['ADMIN'])).toEqual(['*']);
  });

  it('blocks an editor from changing a live post or publishing directly', async () => {
    const { service, post } = setup();
    await expect(service.update('post', 'p1', { title: 'x' }, false)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.status('post', 'p1', { status: 'PUBLISHED' }, false)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.create('post', { status: 'PUBLISHED' } as never, false)).rejects.toBeInstanceOf(ForbiddenException);
    expect(post.update).not.toHaveBeenCalled();
    // An unpublished post is edited directly.
    const draftPost = setup({ status: 'DRAFT', publishedAt: null as never });
    await draftPost.service.update('post', 'p1', { title: 'x' }, false);
    expect(draftPost.post.update).toHaveBeenCalled();
  });

  it('keeps edits to a published post in the draft until approved', async () => {
    const { service, post } = setup();
    await service.saveDraft('p1', { title: 'New title', status: 'DRAFT' } as never);
    const { data } = post.update.mock.calls[0][0];
    expect(data.draft).toEqual({ title: 'New title' }); // status stays with the live post
    expect(data.title).toBeUndefined();
    expect(data.draftUpdatedAt).toBeInstanceOf(Date);
    const unpublished = setup({ status: 'DRAFT' });
    await expect(unpublished.service.saveDraft('p1', { title: 'x' })).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('submits, sends back and approves', async () => {
    await expect(setup().service.submitForReview('p1', 'u1')).rejects.toBeInstanceOf(UnprocessableEntityException);
    const withDraft = setup({ draft: { title: 'New title' } });
    await withDraft.service.submitForReview('p1', 'u1');
    expect(withDraft.post.update.mock.calls[0][0].data).toMatchObject({ reviewStatus: 'PENDING', submittedById: 'u1', reviewNote: null });

    await expect(setup().service.reject('p1', 'a1', 'note')).rejects.toBeInstanceOf(UnprocessableEntityException);
    const pending = setup({ reviewStatus: 'PENDING', draft: { title: 'New title' } });
    await pending.service.reject('p1', 'a1', 'Sửa tiêu đề');
    expect(pending.post.update.mock.calls[0][0].data).toMatchObject({ reviewStatus: 'CHANGES_REQUESTED', reviewNote: 'Sửa tiêu đề', reviewedById: 'a1' });

    const approve = setup({ reviewStatus: 'PENDING', draft: { title: 'New title' } });
    await approve.service.approve('p1', 'a1');
    const { data } = approve.post.update.mock.calls[0][0];
    expect(data).toMatchObject({ title: 'New title', status: 'PUBLISHED', reviewStatus: 'NONE', reviewedById: 'a1', draftUpdatedAt: null });
    expect(data.draft).toBe(Prisma.DbNull);
    expect(data.publishedAt).toEqual(base.publishedAt); // keeps the first publication date
  });

  it('publishes an unpublished post on approval', async () => {
    const { service, post } = setup({ status: 'DRAFT', publishedAt: null as never, reviewStatus: 'PENDING' });
    await service.approve('p1', 'a1');
    const { data } = post.update.mock.calls[0][0];
    expect(data.status).toBe('PUBLISHED');
    expect(data.publishedAt).toBeInstanceOf(Date);
  });

  it('discarding the draft of a live post ends its review', async () => {
    const { service, post } = setup({ reviewStatus: 'PENDING', draft: { title: 'x' } });
    await service.discardDraft('p1');
    expect(post.update.mock.calls[0][0].data).toMatchObject({ draft: Prisma.DbNull, reviewStatus: 'NONE' });
  });
});
