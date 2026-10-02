import { Body, Controller, Post, UseInterceptors } from '@nestjs/common';
import { HoneypotInterceptor } from '../../common/honeypot.interceptor';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CourseRegistrationService } from './course-registration.service';
import { CreateCourseRegistrationDto } from './create-course-registration.dto';
@ApiTags('course registrations')
@Controller('course-registrations')
export class CourseRegistrationController {
  constructor(private readonly service: CourseRegistrationService) {}
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(HoneypotInterceptor)
  @ApiCreatedResponse()
  @ApiNotFoundResponse()
  create(@Body() input: CreateCourseRegistrationDto) {
    return this.service.create(input);
  }
}
