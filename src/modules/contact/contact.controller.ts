import { Body, Controller, Post, UseInterceptors } from '@nestjs/common';
import { HoneypotInterceptor } from '../../common/honeypot.interceptor';
import {
  ApiCreatedResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ContactService } from './contact.service';
import { CreateContactDto } from './create-contact.dto';
@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly service: ContactService) {}
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(HoneypotInterceptor)
  @ApiCreatedResponse()
  @ApiUnprocessableEntityResponse()
  create(@Body() input: CreateContactDto) {
    return this.service.create(input);
  }
}
