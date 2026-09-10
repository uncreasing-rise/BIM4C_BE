import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { SlugPipe } from '../../common/pipes/slug.pipe';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
@ApiTags('courses')
@Controller('courses')
export class CoursesController {
  constructor(private readonly service: CoursesService) {}
  @Get()
  @Header('Cache-Control', 'public, max-age=60, s-maxage=600')
  @ApiOkResponse()
  findAll(@Query() query: PageQueryDto) {
    return this.service.findAll(query);
  }
  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=60, s-maxage=600')
  @ApiOkResponse()
  @ApiNotFoundResponse()
  findOne(@Param('slug', SlugPipe) slug: string) {
    return this.service.findBySlug(slug);
  }
}
