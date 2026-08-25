import { Controller, Get, Header, Param, Query } from '@nestjs/common'; import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ProjectQueryDto } from './project-query.dto'; import { ProjectsService } from './projects.service';
import { SlugPipe } from '../../common/pipes/slug.pipe';
@ApiTags('projects') @Controller('projects') export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}
  @Get() @Header('Cache-Control', 'public, max-age=30, s-maxage=300, stale-while-revalidate=60') @ApiOkResponse() findAll(@Query() query: ProjectQueryDto) { return this.service.findAll(query); }
  @Get(':slug') @Header('Cache-Control', 'public, max-age=30, s-maxage=300, stale-while-revalidate=60') @ApiOkResponse() @ApiNotFoundResponse() findOne(@Param('slug', SlugPipe) slug: string) { return this.service.findBySlug(slug); }
}
