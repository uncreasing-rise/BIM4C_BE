import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AdminResource } from '../auth/permissions';
import { CsrfGuard } from '../auth/csrf.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AppointmentStatus } from '@prisma/client';
import { AppointmentsService } from './appointments.service';
import { AppointmentNotificationsService } from './appointment-notifications.service';
import { AppointmentStatusDto, AvailabilityExceptionDto, AvailabilityQueryDto, AvailabilityRuleDto, CreateAppointmentDto } from './appointments.dto';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}
  @Get('availability') availability(@Query() query: AvailabilityQueryDto) { return this.service.availability(new Date(query.from), new Date(query.to)); }
  @Post() create(@Body() input: CreateAppointmentDto) { return this.service.create(input); }
}

@UseGuards(SessionAuthGuard, PermissionGuard, CsrfGuard)
@AdminResource('appointments')
@Controller('admin/appointments')
export class AdminAppointmentsController {
  constructor(private readonly service: AppointmentsService, private readonly notifications: AppointmentNotificationsService) {}
  @Get() async list(@Query('status') status?: AppointmentStatus) { return { data: await this.service.list(status) }; }
  @Get('google/connect') connectGoogle(@Res() response: Response) { return response.redirect(this.notifications.googleAuthorizationUrl()); }
  @Get('google/callback') async googleCallback(@Query('code') code: string, @Res() response: Response) { await this.notifications.completeGoogleAuthorization(code); return response.send('Google Calendar connected. You can close this tab.'); }
  @Patch(':id/status') async updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() input: AppointmentStatusDto) { return { data: await this.service.updateStatus(id, input) }; }
  @Get('availability/rules') async rules() { return { data: await this.service.rules() }; }
  @Post('availability/rules') async saveRule(@Body() input: AvailabilityRuleDto) { return { data: await this.service.saveRule(input) }; }
  @Delete('availability/rules/:id') deleteRule(@Param('id', ParseUUIDPipe) id: string) { return this.service.deleteRule(id); }
  @Get('availability/exceptions') async exceptions() { return { data: await this.service.exceptions() }; }
  @Post('availability/exceptions') async saveException(@Body() input: AvailabilityExceptionDto) { return { data: await this.service.saveException(input) }; }
  @Delete('availability/exceptions/:id') deleteException(@Param('id', ParseUUIDPipe) id: string) { return this.service.deleteException(id); }
}
