import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { SubmissionNotificationsService } from './submission-notifications.service';

@Module({
  providers: [EmailService, SubmissionNotificationsService],
  exports: [EmailService, SubmissionNotificationsService],
})
export class EmailModule {}
