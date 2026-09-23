import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { normalizeEmail, normalizeText } from '../../common/utils/input';

export class CreateAppointmentDto {
  @Transform(({ value }) => normalizeText(value)) @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @Transform(({ value }) => normalizeEmail(value)) @IsEmail() @MaxLength(320) email!: string;
  @IsOptional() @Transform(({ value }) => normalizeText(value)) @IsString() @MaxLength(32) phone?: string;
  @IsOptional() @Transform(({ value }) => normalizeText(value)) @IsString() @MaxLength(200) company?: string;
  @Transform(({ value }) => normalizeText(value)) @IsString() @MinLength(2) @MaxLength(120) topic!: string;
  @IsOptional() @Transform(({ value }) => normalizeText(value)) @IsString() @MaxLength(5000) message?: string;
  @IsOptional() @Transform(({ value }) => normalizeText(value)) @IsString() @MaxLength(180) projectSlug?: string;
  @IsISO8601() startAt!: string;
  @IsISO8601() endAt!: string;
  @IsOptional() @Transform(({ value }) => normalizeText(value)) @IsString() @MaxLength(64) timezone = 'Asia/Ho_Chi_Minh';
  @IsBoolean() consent!: boolean;
  @Transform(({ value }) => normalizeText(value)) @IsString() @MinLength(1) @MaxLength(64) privacyPolicyVersion!: string;
}

export class AvailabilityQueryDto {
  @IsISO8601() from!: string;
  @IsISO8601() to!: string;
}

export class AvailabilityRuleDto {
  @IsInt() @Min(0) @Max(6)
  weekday!: number;
  @IsString() @MaxLength(5) startTime!: string;
  @IsString() @MaxLength(5) endTime!: string;
  @IsInt() @Min(5) @Max(240)
  durationMinutes = 30;
  @IsInt() @Min(0) @Max(120)
  bufferMinutes = 10;
  @IsBoolean()
  isActive = true;
}

export class AvailabilityExceptionDto {
  @IsISO8601() date!: string;
  @IsBoolean()
  isAvailable = false;
  @IsOptional() @IsString() @MaxLength(5) startTime?: string;
  @IsOptional() @IsString() @MaxLength(5) endTime?: string;
  @IsOptional() @IsString() @MaxLength(240) note?: string;
}

export class AppointmentStatusDto {
  @IsIn(['REQUESTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']) status!: 'REQUESTED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
}
