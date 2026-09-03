import { Body, Controller, Post } from '@nestjs/common';
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
  @ApiCreatedResponse()
  @ApiUnprocessableEntityResponse()
  create(@Body() input: CreateContactDto) {
    return this.service.create(input);
  }
}
