import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
export class PageQueryDto {
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page =
    1;
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
  @IsOptional() @Transform(trimmed) @IsString() @MaxLength(120) search?: string;
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  category?: string;
  @IsOptional() @IsIn(['asc', 'desc']) sortOrder: 'asc' | 'desc' = 'desc';
  @IsOptional()
  @IsIn(['publishedAt', 'createdAt', 'title', 'sortOrder'])
  sortBy: 'publishedAt' | 'createdAt' | 'title' | 'sortOrder' = 'sortOrder';
}
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface PageResponse<T> {
  data: T[];
  meta: PageMeta;
}
export function pageResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PageResponse<T> {
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
