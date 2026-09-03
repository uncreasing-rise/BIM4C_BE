import { Body, Controller, Post } from '@nestjs/common';
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
  @ApiCreatedResponse()
  @ApiNotFoundResponse()
  create(@Body() input: CreateCourseRegistrationDto) {
    return this.service.create(input);
  }
}
