import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseFilePipeBuilder,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { AdminResource } from '../auth/permissions';
import { AdminService } from './admin.service';
import {
  AdminListQueryDto,
  BulkActionDto,
  CategoryDto,
  CourseSectionDto,
  CreateCourseDto,
  CreateContentDto,
  CreatePostDto,
  CreateProjectDto,
  NewsletterStatusDto,
  ProjectImageDto,
  StatusDto,
  SubmissionStatusDto,
  UpdateCategoryDto,
  UpdateContentDto,
  UpdateCourseDto,
  UpdateCourseSectionDto,
  UpdateMediaDto,
  UpdatePostDto,
  UpdateProjectDto,
  UpdateProjectImageDto,
} from './admin.dto';
import { MediaStorageService } from './media-storage.service';

abstract class BaseController {
  constructor(protected readonly service: AdminService) {}
  protected data<T>(data: T) {
    return { data };
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard, CsrfGuard)
@AdminResource('projects')
@ApiTags('Admin Projects')
@Controller('admin/projects')
export class AdminProjectsController extends BaseController {
  constructor(service: AdminService) {
    super(service);
  }
  @Get() list(@Query() q: AdminListQueryDto) {
    return this.service.list('project', q);
  }
  @Get(':id') async detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.data(await this.service.detail('project', id));
  }
  @Post() async create(@Body() dto: CreateProjectDto) {
    return this.data(await this.service.create('project', dto));
  }
  @Patch(':id') async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.data(await this.service.update('project', id, dto));
  }
  @Patch(':id/status') async status(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatusDto,
  ) {
    return this.data(await this.service.status('project', id, dto));
  }
  @Post('bulk') bulk(@Body() dto: BulkActionDto) {
    return this.service.bulk('project', dto);
  }
  @Delete(':id') @HttpCode(204) remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove('project', id);
  }
  @Get(':id/images') async images(@Param('id', ParseUUIDPipe) id: string) {
    return this.data(await this.service.images(id));
  }
  @Post(':id/images') async addImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProjectImageDto,
  ) {
    return this.data(await this.service.addImage(id, dto));
  }
  @Patch(':id/images/:imageId') async updateImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Body() dto: UpdateProjectImageDto,
  ) {
    return this.data(await this.service.updateImage(id, imageId, dto));
  }
  @Delete(':id/images/:imageId') @HttpCode(204) deleteImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.service.deleteImage(id, imageId);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard, CsrfGuard)
@AdminResource('services')
@ApiTags('Admin Services')
@Controller('admin/services')
export class AdminServicesController extends BaseController {
  constructor(service: AdminService) {
    super(service);
  }
  @Get() list(@Query() q: AdminListQueryDto) {
    return this.service.list('service', q);
  }
  @Get(':id') async detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.data(await this.service.detail('service', id));
  }
  @Post() async create(@Body() dto: CreateContentDto) {
    return this.data(await this.service.create('service', dto));
  }
  @Patch(':id') async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContentDto,
  ) {
    return this.data(await this.service.update('service', id, dto));
  }
  @Patch(':id/status') async status(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatusDto,
  ) {
    return this.data(await this.service.status('service', id, dto));
  }
  @Post('bulk') bulk(@Body() dto: BulkActionDto) {
    return this.service.bulk('service', dto);
  }
  @Delete(':id') @HttpCode(204) remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove('service', id);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard, CsrfGuard)
@AdminResource('courses')
@ApiTags('Admin Courses')
@Controller('admin/courses')
export class AdminCoursesController extends BaseController {
  constructor(service: AdminService) {
    super(service);
  }
  @Get() list(@Query() q: AdminListQueryDto) {
    return this.service.list('course', q);
  }
  @Get(':id') async detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.data(await this.service.detail('course', id));
  }
  @Post() async create(@Body() dto: CreateCourseDto) {
    return this.data(await this.service.create('course', dto));
  }
  @Patch(':id') async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.data(await this.service.update('course', id, dto));
  }
  @Patch(':id/status') async status(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatusDto,
  ) {
    return this.data(await this.service.status('course', id, dto));
  }
  @Post('bulk') bulk(@Body() dto: BulkActionDto) {
    return this.service.bulk('course', dto);
  }
  @Delete(':id') @HttpCode(204) remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove('course', id);
  }
  @Get(':id/sections') async sections(@Param('id', ParseUUIDPipe) id: string) {
    return this.data(await this.service.curriculum(id));
  }
  @Post(':id/sections') async addSection(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CourseSectionDto,
  ) {
    return this.data(await this.service.addSection(id, dto));
  }
  @Patch(':id/sections/:sectionId') async updateSection(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
    @Body() dto: UpdateCourseSectionDto,
  ) {
    return this.data(await this.service.updateSection(id, sectionId, dto));
  }
  @Delete(':id/sections/:sectionId') @HttpCode(204) deleteSection(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
  ) {
    return this.service.deleteSection(id, sectionId);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard, CsrfGuard)
@AdminResource('posts')
@ApiTags('Admin Posts')
@Controller('admin/posts')
export class AdminPostsController extends BaseController {
  constructor(service: AdminService) {
    super(service);
  }
  @Get() list(@Query() q: AdminListQueryDto) {
    return this.service.list('post', q);
  }
  @Get(':id') async detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.data(await this.service.detail('post', id));
  }
  @Post() async create(@Body() dto: CreatePostDto) {
    return this.data(await this.service.create('post', dto));
  }
  @Patch(':id') async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.data(await this.service.update('post', id, dto));
  }
  @Patch(':id/status') async status(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatusDto,
  ) {
    return this.data(await this.service.status('post', id, dto));
  }
  @Post('bulk') bulk(@Body() dto: BulkActionDto) {
    return this.service.bulk('post', dto);
  }
  @Delete(':id') @HttpCode(204) remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove('post', id);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard, CsrfGuard)
@AdminResource('project-categories')
@ApiTags('Admin Categories')
@Controller('admin/project-categories')
export class AdminProjectCategoriesController extends BaseController {
  constructor(service: AdminService) {
    super(service);
  }
  @Get() async list() {
    return this.data(await this.service.categories('project'));
  }
  @Post() async create(@Body() dto: CategoryDto) {
    return this.data(await this.service.createCategory('project', dto));
  }
  @Patch(':id') async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.data(await this.service.updateCategory('project', id, dto));
  }
  @Delete(':id') @HttpCode(204) remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteCategory('project', id);
  }
}
@UseGuards(SessionAuthGuard, PermissionGuard, CsrfGuard)
@AdminResource('post-categories')
@ApiTags('Admin Categories')
@Controller('admin/post-categories')
export class AdminPostCategoriesController extends BaseController {
  constructor(service: AdminService) {
    super(service);
  }
  @Get() async list() {
    return this.data(await this.service.categories('post'));
  }
  @Post() async create(@Body() dto: CategoryDto) {
    return this.data(await this.service.createCategory('post', dto));
  }
  @Patch(':id') async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.data(await this.service.updateCategory('post', id, dto));
  }
  @Delete(':id') @HttpCode(204) remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteCategory('post', id);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard, CsrfGuard)
@AdminResource('contacts')
@ApiTags('Admin Contacts')
@Controller('admin/contacts')
export class AdminContactsController extends BaseController {
  constructor(service: AdminService) {
    super(service);
  }
  @Get() list(@Query() q: AdminListQueryDto) {
    return this.service.contacts(q);
  }
  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="contacts.csv"')
  export(@Query() q: AdminListQueryDto) {
    return this.service.exportContacts(q);
  }
  @Get(':id') async detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.data(await this.service.contact(id));
  }
  @Patch(':id') async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmissionStatusDto,
  ) {
    return this.data(await this.service.updateContact(id, dto));
  }
  @Delete(':id') @HttpCode(204) remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteContact(id);
  }
}
@UseGuards(SessionAuthGuard, PermissionGuard, CsrfGuard)
@AdminResource('course-registrations')
@ApiTags('Admin Course Registrations')
@Controller('admin/course-registrations')
export class AdminRegistrationsController extends BaseController {
  constructor(service: AdminService) {
    super(service);
  }
  @Get() list(@Query() q: AdminListQueryDto) {
    return this.service.registrations(q);
  }
  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="course-registrations.csv"',
  )
  export(@Query() q: AdminListQueryDto) {
    return this.service.exportRegistrations(q);
  }
  @Get(':id') async detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.data(await this.service.registration(id));
  }
  @Patch(':id') async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmissionStatusDto,
  ) {
    return this.data(await this.service.updateRegistration(id, dto));
  }
  @Delete(':id') @HttpCode(204) remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteRegistration(id);
  }
}
@UseGuards(SessionAuthGuard, PermissionGuard, CsrfGuard)
@AdminResource('newsletter')
@ApiTags('Admin Newsletter')
@Controller('admin/newsletter/subscriptions')
export class AdminNewsletterController extends BaseController {
  constructor(service: AdminService) {
    super(service);
  }
  @Get() list(@Query() q: AdminListQueryDto) {
    return this.service.subscriptions(q);
  }
  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="newsletter.csv"')
  export(@Query() q: AdminListQueryDto) {
    return this.service.exportSubscriptions(q);
  }
  @Get(':id') async detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.data(await this.service.subscription(id));
  }
  @Patch(':id') async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NewsletterStatusDto,
  ) {
    return this.data(await this.service.updateSubscription(id, dto));
  }
  @Delete(':id') @HttpCode(204) remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteSubscription(id);
  }
}
@UseGuards(SessionAuthGuard, PermissionGuard)
@AdminResource('dashboard')
@ApiTags('Admin Dashboard')
@Controller('admin/dashboard')
export class AdminDashboardController extends BaseController {
  constructor(service: AdminService) {
    super(service);
  }
  @Get('stats') async stats() {
    return this.data(await this.service.dashboard());
  }
  @Get('recent-activity') async recent() {
    return this.data(await this.service.recent());
  }
}
@UseGuards(SessionAuthGuard, PermissionGuard, CsrfGuard)
@AdminResource('media')
@ApiTags('Admin Media')
@Controller('admin/media')
export class AdminMediaController extends BaseController {
  constructor(service: AdminService) {
    super(service);
  }
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  async upload(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: 10 * 1024 * 1024 })
        .addFileTypeValidator({ fileType: /^image\// })
        .build(),
    )
    file: Express.Multer.File,
    @Body('alt') alt?: string,
  ) {
    return this.data(await this.service.uploadMedia(file, alt));
  }
  @Get() list(@Query() q: AdminListQueryDto) {
    return this.service.media(q);
  }
  @Get(':id') async detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.data(await this.service.mediaDetail(id));
  }
  @Patch(':id') async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMediaDto,
  ) {
    return this.data(await this.service.updateMedia(id, dto));
  }
  @Delete(':id') @HttpCode(204) remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteMedia(id);
  }
}

@ApiTags('Media')
@Controller('media/files')
export class MediaFilesController {
  constructor(private readonly storage: MediaStorageService) {}
  @Get(':key') async file(@Param('key') key: string) {
    return new StreamableFile(await this.storage.read(key), {
      type: this.mime(key),
    });
  }
  private mime(key: string) {
    const ext = key.split('.').pop()?.toLowerCase();
    return ext === 'png'
      ? 'image/png'
      : ext === 'webp'
        ? 'image/webp'
        : ext === 'gif'
          ? 'image/gif'
          : 'image/jpeg';
  }
}
