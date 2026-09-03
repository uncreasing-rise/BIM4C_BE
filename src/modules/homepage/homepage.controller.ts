import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { AdminResource } from '../auth/permissions';
import {
  CreateHeroSlideDto,
  CreatePartnerDto,
  UpdateHeroSlideDto,
  UpdatePartnerDto,
} from './homepage.dto';
import { HomepageService } from './homepage.service';
@Controller('homepage')
export class HomepageController {
  constructor(private readonly service: HomepageService) {}
  @Get('slides') slides() {
    return this.service.slides();
  }
  @Get('partners') partners() {
    return this.service.partners();
  }
}
@UseGuards(SessionAuthGuard, PermissionGuard, CsrfGuard)
@AdminResource('homepage')
@Controller('admin/homepage')
export class HomepageAdminController {
  constructor(private readonly service: HomepageService) {}
  @Get('slides') slides() {
    return this.service.slides(true);
  }
  @Post('slides') createSlide(@Body() body: CreateHeroSlideDto) {
    return this.service.createSlide(body);
  }
  @Patch('slides/:id') updateSlide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateHeroSlideDto,
  ) {
    return this.service.updateSlide(id, body);
  }
  @Delete('slides/:id') @HttpCode(204) deleteSlide(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteSlide(id);
  }
  @Get('partners') partners() {
    return this.service.partners(true);
  }
  @Post('partners') createPartner(@Body() body: CreatePartnerDto) {
    return this.service.createPartner(body);
  }
  @Patch('partners/:id') updatePartner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdatePartnerDto,
  ) {
    return this.service.updatePartner(id, body);
  }
  @Delete('partners/:id') @HttpCode(204) deletePartner(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deletePartner(id);
  }
}
