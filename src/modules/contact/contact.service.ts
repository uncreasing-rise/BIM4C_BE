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
    await this.prisma.contact.create({ data: input });
    return { success: true, message: 'Yêu cầu liên hệ đã được ghi nhận.' };
  }
}
