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
  @Header('Cache-Control', 'public, max-age=0, s-maxage=0, must-revalidate')
  @ApiOkResponse()
  findAll(@Query() query: PageQueryDto & { group?: 'technical' | 'news' }) {
    return this.service.findAll(query);
  }

  @Get('categories')
  @Header('Cache-Control', 'public, max-age=0, s-maxage=0, must-revalidate')
  @ApiOkResponse()
  getCategories(@Query('group') group?: 'technical' | 'news') {
    return this.service.getCategories(group);
  }

  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=0, s-maxage=0, must-revalidate')
  @ApiOkResponse()
  @ApiNotFoundResponse()
  findOne(@Param('slug', SlugPipe) slug: string) {
    return this.service.findBySlug(slug);
  }
}
