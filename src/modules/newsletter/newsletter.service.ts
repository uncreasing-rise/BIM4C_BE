import { Injectable } from '@nestjs/common';
import type { MutationResponse } from '../contact/contact.service';
import { PrismaService } from '../../database/prisma.service';
import type { CreateNewsletterSubscriptionDto } from './create-newsletter-subscription.dto';

@Injectable()
export class NewsletterService {
  constructor(private readonly prisma: PrismaService) {}
  async subscribe(
    input: CreateNewsletterSubscriptionDto,
  ): Promise<MutationResponse> {
    await this.prisma.newsletterSubscription.upsert({
      where: { email: input.email },
      create: { ...input, isActive: true },
      update: { consent: true, isActive: true, unsubscribedAt: null },
    });
    return { success: true, message: 'Đăng ký nhận tin thành công.' };
  }
}
