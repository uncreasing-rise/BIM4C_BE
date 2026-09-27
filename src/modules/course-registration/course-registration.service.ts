import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import type { MutationResponse } from '../contact/contact.service';
import { PrismaService } from '../../database/prisma.service';
import type { CreateCourseRegistrationDto } from './create-course-registration.dto';
import { SubmissionNotificationsService } from '../email/submission-notifications.service';
@Injectable()
export class CourseRegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: SubmissionNotificationsService,
  ) {}
  async create(input: CreateCourseRegistrationDto): Promise<MutationResponse> {
    const course = await this.prisma.course.findFirst({
      where: {
        id: input.courseId,
        status: ContentStatus.PUBLISHED,
        deletedAt: null,
      },
      select: { id: true, title: true, title_vi: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    const { consent, privacyPolicyVersion, locale, ...data } = input;
    const row = await this.prisma.courseRegistration.create({
      data: {
        ...data,
        consentGiven: consent,
        consentAt: new Date(),
        privacyPolicyVersion,
        consentSource: 'website',
      },
    });
    const notification = await this.notifications.enquiry(
      'course',
      row,
      locale,
      locale === 'en' ? course.title : course.title_vi || course.title,
    );
    return {
      success: true,
      message:
        locale === 'en'
          ? 'Your course enquiry has been received. Our training team will contact you.'
          : 'Đã nhận yêu cầu tư vấn khóa học. Đội ngũ đào tạo sẽ liên hệ với bạn.',
      notification,
    };
  }
}
