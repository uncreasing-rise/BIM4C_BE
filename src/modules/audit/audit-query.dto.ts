import { AuditAction } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() || undefined : value;
const integer = ({ value }: { value: unknown }): unknown =>
  value === undefined || value === '' ? undefined : Number(value);

export class AuditQueryDto {
  @IsOptional() @Transform(integer) @IsInt() @Min(1) page = 1;
  @IsOptional() @Transform(integer) @IsInt() @Min(1) @Max(100) limit = 20;
  /** Actor name/email, resource key or record id. */
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) search?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) resource?: string;
  @IsOptional() @IsEnum(AuditAction) action?: AuditAction;
  @IsOptional() @IsIn(['createdAt', 'action', 'resource']) sortBy?:
    | 'createdAt'
    | 'action'
    | 'resource';
  @IsOptional() @IsIn(['asc', 'desc']) sortOrder: 'asc' | 'desc' = 'desc';
}
