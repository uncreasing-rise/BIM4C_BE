import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { HoneypotInterceptor } from '../../common/honeypot.interceptor';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CreateNewsletterSubscriptionDto } from './create-newsletter-subscription.dto';
import { NewsletterService } from './newsletter.service';
@ApiTags('newsletter')
@Controller('newsletter/subscriptions')
export class NewsletterController {
  constructor(private readonly service: NewsletterService) {}
  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(HoneypotInterceptor)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOkResponse({ description: 'Idempotent subscription success' })
  subscribe(@Body() input: CreateNewsletterSubscriptionDto) {
    return this.service.subscribe(input);
  }
}
