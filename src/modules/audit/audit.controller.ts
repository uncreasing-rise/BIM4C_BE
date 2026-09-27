import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditQueryDto } from './audit-query.dto';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { AdminResource } from '../auth/permissions';
import { AuditService } from './audit.service';
@ApiTags('Admin Audit')
@Controller('admin/audit-logs')
@UseGuards(SessionAuthGuard, PermissionGuard)
@AdminResource('audit')
export class AuditController {
  constructor(private readonly service: AuditService) {}
  @Get() list(@Query() query: AuditQueryDto) {
    return this.service.list(query);
  }
  @Get(':id') async detail(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.service.detail(id) };
  }
}
