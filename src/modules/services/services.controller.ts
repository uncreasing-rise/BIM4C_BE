import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { SlugPipe } from '../../common/pipes/slug.pipe';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
@ApiTags('services')
@Controller('services')
export class ServicesController {
  constructor(private readonly service: ServicesService) {}
  @Get()
  @Header(
    'Cache-Control',
    'public, max-age=0, s-maxage=0, must-revalidate',
  )
  @ApiOkResponse()
  findAll(@Query() query: PageQueryDto) {
    return this.service.findAll(query);
  }
  @Get(':slug')
  @Header(
    'Cache-Control',
    'public, max-age=0, s-maxage=0, must-revalidate',
  )
  @ApiOkResponse()
  @ApiNotFoundResponse()
  findOne(@Param('slug', SlugPipe) slug: string) {
    return this.service.findBySlug(slug);
  }
}
