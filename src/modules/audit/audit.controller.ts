import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { SessionAuthGuard } from '../auth/session-auth.guard'; import { PermissionGuard } from '../auth/permission.guard'; import { AdminResource } from '../auth/permissions'; import { AuditService } from './audit.service';
@ApiTags('Admin Audit') @Controller('admin/audit-logs') @UseGuards(SessionAuthGuard, PermissionGuard) @AdminResource('audit')
export class AuditController { constructor(private readonly service: AuditService) {} @Get() list(@Query('page') page='1',@Query('limit') limit='20',@Query('resource') resource?:string,@Query('action') action?:AuditAction){return this.service.list(Math.max(1,Number(page)||1),Math.min(100,Math.max(1,Number(limit)||20)),resource,action)} @Get(':id') async detail(@Param('id',ParseUUIDPipe) id:string){return {data:await this.service.detail(id)}} }
