import { Controller, Get, Header, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { SlugPipe } from '../../common/pipes/slug.pipe';
@ApiTags('services')
@Controller('services')
export class ServicesController {
  constructor(private readonly service: ServicesService) {}
  @Get()
  @Header(
    'Cache-Control',
    'public, max-age=60, s-maxage=600, stale-while-revalidate=60',
  )
  @ApiOkResponse()
  findAll() {
    return this.service.findAll();
  }
  @Get(':slug')
  @Header(
    'Cache-Control',
    'public, max-age=60, s-maxage=600, stale-while-revalidate=60',
  )
  @ApiOkResponse()
  @ApiNotFoundResponse()
  findOne(@Param('slug', SlugPipe) slug: string) {
    return this.service.findBySlug(slug);
  }
}
