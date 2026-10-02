import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { HoneypotInterceptor } from '../../common/honeypot.interceptor';
import { Throttle } from '@nestjs/throttler';
import { AdminResource } from '../auth/permissions';
import { CsrfGuard } from '../auth/csrf.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AppointmentsService } from './appointments.service';
import {
  AppointmentListQueryDto,
  AppointmentStatusDto,
  AvailabilityQueryDto,
  CreateAppointmentDto,
} from './appointments.dto';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}
  @Get('availability') availability(@Query() query: AvailabilityQueryDto) {
    return this.service.availability(new Date(query.from), new Date(query.to));
  }
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(HoneypotInterceptor)
  create(@Body() input: CreateAppointmentDto) {
    return this.service.create(input);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard, CsrfGuard)
@AdminResource('appointments')
@Controller('admin/appointments')
export class AdminAppointmentsController {
  constructor(private readonly service: AppointmentsService) {}
  @Get() async list(@Query() query: AppointmentListQueryDto) {
    return { data: await this.service.list(query.status) };
  }
  @Patch(':id/status') async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AppointmentStatusDto,
  ) {
    return { data: await this.service.updateStatus(id, input) };
  }
}
