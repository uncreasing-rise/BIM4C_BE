import { leadAttribution } from '../analytics/analytics.utils';
import { Injectable } from '@nestjs/common';
import type { MutationResponse } from '../contact/contact.service';
import { PrismaService } from '../../database/prisma.service';
import type { CreateNewsletterSubscriptionDto } from './create-newsletter-subscription.dto';
import { SubmissionNotificationsService } from '../email/submission-notifications.service';

@Injectable()
export class NewsletterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: SubmissionNotificationsService,
  ) {}
  async subscribe(
    input: CreateNewsletterSubscriptionDto,
  ): Promise<MutationResponse> {
    const { locale, ...data } = input;
    const existing = await this.prisma.newsletterSubscription.findUnique({
      where: { email: input.email },
      select: { isActive: true },
    });
    const row = await this.prisma.newsletterSubscription.upsert({
      where: { email: input.email },
      create: {
        ...data,
        attribution: leadAttribution(data.attribution),
        consentAt: new Date(),
        consentSource: 'website',
        isActive: true,
      },
      update: {
        consent: true,
        consentAt: new Date(),
        privacyPolicyVersion: input.privacyPolicyVersion,
        consentSource: 'website',
        isActive: true,
        unsubscribedAt: null,
      },
    });
    // Repeated submissions must not send a new welcome email to an active subscriber.
    const customer = existing?.isActive
      ? 'skipped'
      : await this.notifications.newsletter(row.id, row.email, locale);
    return {
      success: true,
      message:
        locale === 'en'
          ? 'Your subscription is active. Thank you for joining BIM4C Insights.'
          : 'Đăng ký nhận tin đã được ghi nhận. Cảm ơn bạn đã đồng hành cùng BIM4C Insights.',
      notification: { customer },
    };
  }
}
