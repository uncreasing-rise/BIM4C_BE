import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { AdminResource } from '../auth/permissions';
import { UpdatePageContentDto } from './page-content.dto';
import { PAGE_CONTENT_KEYS } from './page-content.keys';
import { PageContentService } from './page-content.service';

@ApiTags('Page content')
@Controller()
export class PageContentController {
  constructor(private readonly service: PageContentService) {}

  @Get('page-content') async public() {
    return { data: await this.service.public() };
  }

  @Get('admin/page-content')
  @UseGuards(SessionAuthGuard, PermissionGuard, CsrfGuard)
  @AdminResource('page-content')
  async list() {
    return { data: await this.service.list(), keys: PAGE_CONTENT_KEYS };
  }

  @Patch('admin/page-content/:key')
  @UseGuards(SessionAuthGuard, PermissionGuard, CsrfGuard)
  @AdminResource('page-content')
  async update(@Param('key') key: string, @Body() dto: UpdatePageContentDto) {
    return { data: await this.service.update(key, dto) };
  }
}
