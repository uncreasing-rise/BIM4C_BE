import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { validateEnvironment } from './config/env';
import { DatabaseModule } from './database/database.module';
import { ContactModule } from './modules/contact/contact.module';
import { CourseRegistrationModule } from './modules/course-registration/course-registration.module';
import { CoursesModule } from './modules/courses/courses.module';
import { HealthModule } from './modules/health/health.module';
import { NewsletterModule } from './modules/newsletter/newsletter.module';
import { PostsModule } from './modules/posts/posts.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ServicesModule } from './modules/services/services.module';
import { HomepageModule } from './modules/homepage/homepage.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AdminMutationInterceptor } from './modules/audit/admin-mutation.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnvironment }),
    ThrottlerModule.forRootAsync({ inject: [ConfigService], useFactory: (config: ConfigService) => [{ ttl: config.getOrThrow<number>('RATE_LIMIT_TTL_MS'), limit: config.getOrThrow<number>('RATE_LIMIT_MAX') }] }),
    DatabaseModule, AuditModule, AuthModule, UsersModule, SettingsModule, ServicesModule, ProjectsModule, CoursesModule, PostsModule, ContactModule, CourseRegistrationModule, NewsletterModule, HomepageModule, AdminModule, HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }, { provide: APP_INTERCEPTOR, useClass: AdminMutationInterceptor }],
})
export class AppModule implements NestModule { configure(consumer: MiddlewareConsumer): void { consumer.apply(RequestContextMiddleware).forRoutes('*'); } }
