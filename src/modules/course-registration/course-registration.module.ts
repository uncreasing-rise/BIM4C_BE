import { EmailModule } from '../email/email.module';
import { Module } from '@nestjs/common';
import { CourseRegistrationController } from './course-registration.controller';
import { CourseRegistrationService } from './course-registration.service';
@Module({
  imports: [EmailModule],
  controllers: [CourseRegistrationController],
  providers: [CourseRegistrationService],
})
export class CourseRegistrationModule {}
