import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AdminResource } from '../auth/permissions';
import { CsrfGuard } from '../auth/csrf.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AppointmentsService } from './appointments.service';
import { AppointmentNotificationsService } from './appointment-notifications.service';
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
  create(@Body() input: CreateAppointmentDto) {
    return this.service.create(input);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard, CsrfGuard)
@AdminResource('appointments')
@Controller('admin/appointments')
export class AdminAppointmentsController {
  constructor(
    private readonly service: AppointmentsService,
    private readonly notifications: AppointmentNotificationsService,
    private readonly config: ConfigService,
  ) {}
  @Get() async list(@Query() query: AppointmentListQueryDto) {
    return { data: await this.service.list(query.status) };
  }
  @Get('google/status') async googleStatus() {
    return { data: { connected: await this.notifications.isGoogleConnected() } };
  }
  @Get('google/auth-url') googleAuthUrl(@Req() request: Request) {
    return {
      data: {
        url: this.notifications.googleAuthorizationUrl(request.admin!.sessionId),
      },
    };
  }
  @Get('google/connect') connectGoogle(
    @Req() request: Request,
    @Res() response: Response,
  ) {
    return response.redirect(
      this.notifications.googleAuthorizationUrl(request.admin!.sessionId),
    );
  }
  @Get('google/callback') async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    await this.notifications.completeGoogleAuthorization(code, state);
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    return response.redirect(
      `${frontendUrl}/admin/lich-tu-van?google_connected=true`,
    );
  }
  @Patch(':id/status') async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AppointmentStatusDto,
  ) {
    return { data: await this.service.updateStatus(id, input) };
  }
}
