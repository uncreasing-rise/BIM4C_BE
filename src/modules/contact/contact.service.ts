import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { CreateContactDto } from './create-contact.dto';
import { SubmissionNotificationsService } from '../email/submission-notifications.service';
import type { EmailDelivery } from '../email/email.service';
export interface MutationResponse {
  success: true;
  message: string;
  notification?: { customer: EmailDelivery; admin?: EmailDelivery };
}
@Injectable()
export class ContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: SubmissionNotificationsService,
  ) {}
  async create(input: CreateContactDto): Promise<MutationResponse> {
    const { consent, privacyPolicyVersion, locale, ...data } = input;
    const row = await this.prisma.contact.create({
      data: {
        ...data,
        consentGiven: consent,
        consentAt: new Date(),
        privacyPolicyVersion,
        consentSource: 'website',
      },
    });
    const notification = await this.notifications.enquiry(
      'contact',
      row,
      locale,
    );
    return {
      success: true,
      message:
        locale === 'en'
          ? 'Your enquiry has been received. Our team will contact you.'
          : 'Yêu cầu đã được ghi nhận. Đội ngũ BIM4C sẽ liên hệ với bạn.',
      notification,
    };
  }
}
