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
  typeof value === 'string' ? value.trim() || undefined : value;
// `?page=` must fall back to the default instead of failing as 0.
const integer = ({ value }: { value: unknown }): unknown =>
  value === undefined || value === '' ? undefined : Number(value);
export class PageQueryDto {
  @IsOptional() @Transform(integer) @IsInt() @Min(1) page = 1;
  @IsOptional()
  @Transform(integer)
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
  // No defaults: each catalogue has its own natural order.
  @IsOptional() @IsIn(['asc', 'desc']) sortOrder?: 'asc' | 'desc';
  @IsOptional()
  @IsIn(['publishedAt', 'createdAt', 'title', 'sortOrder'])
  sortBy?: 'publishedAt' | 'createdAt' | 'title' | 'sortOrder';
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

type Direction = 'asc' | 'desc';
type OrderTerm = Record<
  string,
  Direction | { sort: Direction; nulls: 'first' | 'last' }
>;

/**
 * Offset pagination needs a total order. Rows sharing the sort value (e.g. the
 * same sortOrder or publishedAt) otherwise come back in arbitrary order, so a
 * row can appear on two pages while another never appears.
 */
export function stableOrderBy(
  sortBy: string | undefined,
  sortOrder: Direction | undefined,
  fallback: OrderTerm[],
): OrderTerm[] {
  const primary: OrderTerm[] = !sortBy
    ? fallback
    : sortBy === 'publishedAt'
      ? [{ publishedAt: { sort: sortOrder ?? 'desc', nulls: 'last' } }]
      : [{ [sortBy]: sortOrder ?? (sortBy === 'sortOrder' ? 'asc' : 'desc') }];
  return [...primary, { createdAt: 'desc' }, { id: 'asc' }];
}

/** Default public catalogue order: curated position first, newest next. */
export const CURATED_ORDER: OrderTerm[] = [
  { sortOrder: 'asc' },
  { publishedAt: { sort: 'desc', nulls: 'last' } },
];
