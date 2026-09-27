import { ContactService } from '../contact/contact.service';
import { CourseRegistrationService } from '../course-registration/course-registration.service';
import { NewsletterService } from '../newsletter/newsletter.service';
import { SubmissionNotificationsService } from './submission-notifications.service';

describe('Submission notifications', () => {
  const input = {
    name: 'Alex',
    email: 'alex@example.com',
    message: 'Please contact me',
    consent: true,
    privacyPolicyVersion: 'v1',
    locale: 'en',
  };

  it('saves contact before notifying and does not persist transport-only locale', async () => {
    const prisma = {
      contact: { create: jest.fn().mockResolvedValue({ id: 'c1', ...input }) },
    };
    const notifications = {
      enquiry: jest
        .fn()
        .mockResolvedValue({ customer: 'failed', admin: 'sent' }),
    };
    const result = await new ContactService(
      prisma as never,
      notifications as never,
    ).create(input as never);
    const call = prisma.contact.create.mock.calls[0] as [{ data: object }];
    expect(call[0].data).not.toHaveProperty('locale');
    expect(prisma.contact.create.mock.invocationCallOrder[0]).toBeLessThan(
      notifications.enquiry.mock.invocationCallOrder[0],
    );
    expect(notifications.enquiry).toHaveBeenCalledWith(
      'contact',
      expect.objectContaining({ id: 'c1' }),
      'en',
    );
    expect(result.success).toBe(true);
    expect(result.notification?.customer).toBe('failed');
  });

  it('uses the localized published course title', async () => {
    const prisma = {
      course: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'course',
          title: 'BIM fundamentals',
          title_vi: 'BIM cơ bản',
        }),
      },
      courseRegistration: {
        create: jest.fn().mockResolvedValue({ id: 'r1', ...input }),
      },
    };
    const notifications = {
      enquiry: jest.fn().mockResolvedValue({ customer: 'sent', admin: 'sent' }),
    };
    await new CourseRegistrationService(
      prisma as never,
      notifications as never,
    ).create({ ...input, courseId: 'course', phone: '+123456789' } as never);
    expect(notifications.enquiry).toHaveBeenCalledWith(
      'course',
      expect.anything(),
      'en',
      'BIM fundamentals',
    );
  });

  it('sends independent customer and admin messages with a reply address', async () => {
    const email = {
      adminEmail: 'team@example.com',
      url: (path: string) => `https://example.com${path}`,
      send: jest
        .fn()
        .mockResolvedValueOnce('failed')
        .mockResolvedValueOnce('sent'),
    };
    const result = await new SubmissionNotificationsService(
      email as never,
    ).enquiry('contact', { id: 'c1', ...input }, 'en');
    expect(email.send).toHaveBeenCalledTimes(2);
    const calls = email.send.mock.calls as [
      { content: { locale: string }; replyTo?: string },
    ][];
    expect(calls[0][0].content.locale).toBe('en');
    expect(calls[1][0].replyTo).toBe(input.email);
    expect(result).toEqual({ customer: 'failed', admin: 'sent' });
  });

  it('does not repeat welcome messages for active newsletter subscribers', async () => {
    const prisma = {
      newsletterSubscription: {
        findUnique: jest.fn().mockResolvedValue({ isActive: true }),
        upsert: jest.fn().mockResolvedValue({ id: 'n1', email: input.email }),
      },
    };
    const notifications = { newsletter: jest.fn() };
    await new NewsletterService(
      prisma as never,
      notifications as never,
    ).subscribe(input as never);
    expect(notifications.newsletter).not.toHaveBeenCalled();
    const call = prisma.newsletterSubscription.upsert.mock.calls[0] as [
      { create: object },
    ];
    expect(call[0].create).not.toHaveProperty('locale');
  });
});
