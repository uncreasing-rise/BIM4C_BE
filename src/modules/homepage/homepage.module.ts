import { Module } from '@nestjs/common'; import { HomepageAdminController,HomepageController } from './homepage.controller'; import { HomepageService } from './homepage.service';
@Module({controllers:[HomepageController,HomepageAdminController],providers:[HomepageService]}) export class HomepageModule{}
