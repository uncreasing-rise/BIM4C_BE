import { EmailModule } from '../email/email.module';
import { Module } from '@nestjs/common';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';
@Module({
  imports: [EmailModule],
  controllers: [NewsletterController],
  providers: [NewsletterService],
})
export class NewsletterModule {}
