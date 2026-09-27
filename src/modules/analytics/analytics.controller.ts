import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { AdminResource } from '../auth/permissions';
import { AnalyticsRangeDto, TrackEventsDto } from './analytics.dto';
import { AnalyticsService, toRange } from './analytics.service';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  /** Page views and clicks from the public site, sent in small batches. */
  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  async track(@Body() input: TrackEventsDto, @Req() request: Request) {
    const accepted = await this.service.track(input.events, request.headers, request.socket?.remoteAddress);
    return { accepted };
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard, CsrfGuard)
@AdminResource('analytics')
@ApiTags('Admin Analytics')
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('report')
  async report(@Query() query: AnalyticsRangeDto) {
    return { data: await this.service.report(toRange(query.from, query.to)) };
  }

  @Get('realtime')
  async realtime() {
    return { data: await this.service.realtime() };
  }

  @Get('leads')
  async leads(@Query() query: AnalyticsRangeDto) {
    return { data: await this.service.leads(toRange(query.from, query.to)) };
  }
}
