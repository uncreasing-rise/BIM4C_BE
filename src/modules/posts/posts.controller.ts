import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
import { PostsService } from './posts.service';
import { SlugPipe } from '../../common/pipes/slug.pipe';
@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly service: PostsService) {}
  @Get()
  @Header('Cache-Control', 'public, max-age=30, s-maxage=300')
  @ApiOkResponse()
  findAll(@Query() query: PageQueryDto) {
    return this.service.findAll(query);
  }
  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=30, s-maxage=300')
  @ApiOkResponse()
  @ApiNotFoundResponse()
  findOne(@Param('slug', SlugPipe) slug: string) {
    return this.service.findBySlug(slug);
  }
}
