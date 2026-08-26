import { OmitType, PartialType } from '@nestjs/swagger';
import { ContentStatus, ProjectStatus, SubmissionStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => typeof value === 'string' ? value.trim() : value;

export class AdminListQueryDto {
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page = 1;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) search?: string;
  @IsOptional() @Transform(trim) @IsIn(['draft', 'published', 'archived', 'planned', 'in_progress', 'completed', 'active', 'unsubscribed', 'new', 'resolved', 'spam']) status?: string;
  @IsOptional() @IsUUID() category?: string;
  @IsOptional() @IsUUID() course?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsIn(['createdAt', 'updatedAt', 'publishedAt', 'title', 'sortOrder']) sortBy = 'updatedAt';
  @IsOptional() @IsIn(['asc', 'desc']) sortOrder: 'asc' | 'desc' = 'desc';
}

export class ContentMediaDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(1000) url!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(240) alt?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) caption?: string;
  @IsOptional() @IsInt() @Min(1) @Max(10000) width?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10000) height?: number;
}

export class ContentSectionDto {
  @IsString() @MinLength(1) @MaxLength(240) title!: string;
  @IsString() @MinLength(1) @MaxLength(20000) body!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => ContentMediaDto) images?: ContentMediaDto[];
  @IsOptional() @IsIn(['stack', 'grid']) imageLayout?: 'stack' | 'grid';
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) unorderedList?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) orderedList?: string[];
  @IsOptional() @Transform(trim) @IsString() @MaxLength(5000) quote?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(1000) videoUrl?: string;
}

export class CreateContentDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(180) slug!: string;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(240) title!: string;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(1000) description!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(500) image!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(160) eyebrow!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(240) meta?: string | null;
  @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) highlights!: string[];
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ContentSectionDto) sections!: ContentSectionDto[];
  @IsOptional() @IsEnum(ContentStatus) status?: ContentStatus;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsDateString() publishedAt?: string | null;
}
export class UpdateContentDto extends PartialType(CreateContentDto) {}

export class CreateProjectDto extends OmitType(CreateContentDto, ['status'] as const) {
  @IsUUID() categoryId!: string;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(180) location!: string;
  @IsInt() @Min(1900) @Max(2200) year!: number;
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
}
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

export class CreatePostDto extends CreateContentDto {
  @IsOptional() @IsUUID() categoryId?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(160) authorName?: string | null;
}
export class UpdatePostDto extends PartialType(CreatePostDto) {}

export class BulkActionDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsUUID('4', { each: true }) ids!: string[];
  @IsIn(['publish', 'unpublish', 'archive', 'delete']) action!: 'publish' | 'unpublish' | 'archive' | 'delete';
}

export class StatusDto { @IsString() @IsNotEmpty() status!: string }
export class CategoryDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(120) slug!: string;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(160) name!: string;
}
export class UpdateCategoryDto extends PartialType(CategoryDto) {}

export class ProjectImageDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(500) url!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(240) alt!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) caption?: string | null;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
export class UpdateProjectImageDto extends PartialType(ProjectImageDto) {}

export class CourseSectionDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(240) title!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(30000) description!: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
export class UpdateCourseSectionDto extends PartialType(CourseSectionDto) {}

export class SubmissionStatusDto { @IsEnum(SubmissionStatus) status!: SubmissionStatus }
export class NewsletterStatusDto { @IsBoolean() isActive!: boolean }
export class UpdateMediaDto { @IsOptional() @Transform(trim) @IsString() @MaxLength(240) alt?: string | null }
