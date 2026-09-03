import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { CreateContactDto } from './create-contact.dto';
export interface MutationResponse {
  success: true;
  message: string;
}
@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}
  async create(input: CreateContactDto): Promise<MutationResponse> {
    const { consent, privacyPolicyVersion, ...data } = input;
    await this.prisma.contact.create({ data: { ...data, consentGiven: consent, consentAt: new Date(), privacyPolicyVersion, consentSource: 'website' } });
    return { success: true, message: 'Yêu cầu liên hệ đã được ghi nhận.' };
  }
}
