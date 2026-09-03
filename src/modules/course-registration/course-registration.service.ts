import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import type { MutationResponse } from '../contact/contact.service';
import { PrismaService } from '../../database/prisma.service';
import type { CreateCourseRegistrationDto } from './create-course-registration.dto';
@Injectable()
export class CourseRegistrationService {
  constructor(private readonly prisma: PrismaService) {}
  async create(input: CreateCourseRegistrationDto): Promise<MutationResponse> {
    const course = await this.prisma.course.findFirst({
      where: {
        id: input.courseId,
        status: ContentStatus.PUBLISHED,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    const { consent, privacyPolicyVersion, ...data } = input;
    await this.prisma.courseRegistration.create({ data: { ...data, consentGiven: consent, consentAt: new Date(), privacyPolicyVersion, consentSource: 'website' } });
    return { success: true, message: 'Đăng ký khóa học đã được ghi nhận.' };
  }
}
