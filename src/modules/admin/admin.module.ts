import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminContactsController, AdminCoursesController, AdminDashboardController, AdminMediaController, AdminNewsletterController, AdminPostCategoriesController, AdminPostsController, AdminProjectCategoriesController, AdminProjectsController, AdminRegistrationsController, AdminServicesController, MediaFilesController } from './admin.controller';
import { MediaStorageService } from './media-storage.service';

@Module({
  controllers: [AdminProjectsController, AdminServicesController, AdminCoursesController, AdminPostsController, AdminProjectCategoriesController, AdminPostCategoriesController, AdminContactsController, AdminRegistrationsController, AdminNewsletterController, AdminDashboardController, AdminMediaController, MediaFilesController],
  providers: [AdminService, MediaStorageService],
})
export class AdminModule {}
