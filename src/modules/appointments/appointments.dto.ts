import { AppointmentStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsTimeZone,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { normalizeEmail, normalizeText } from '../../common/utils/input';
import { TIME_OF_DAY } from './availability';

const text = ({ value }: { value: unknown }) => normalizeText(value);
const HH_MM = { message: '$property must use 24-hour HH:MM format' };

export class CreateAppointmentDto {
  @Transform(text) @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  @MaxLength(320)
  email!: string;
  @IsOptional() @Transform(text) @IsString() @MaxLength(32) phone?: string;
  @IsOptional() @Transform(text) @IsString() @MaxLength(200) company?: string;
  @Transform(text) @IsString() @MinLength(2) @MaxLength(120) topic!: string;
  @IsOptional() @Transform(text) @IsString() @MaxLength(5000) message?: string;
  @IsOptional()
  @Transform(text)
  @IsString()
  @MaxLength(180)
  projectSlug?: string;
  @IsISO8601() startAt!: string;
  @IsISO8601() endAt!: string;
  @IsOptional()
  @Transform(text)
  @IsString()
  @MaxLength(64)
  @IsTimeZone()
  timezone = 'Asia/Ho_Chi_Minh';
  @IsBoolean() @Equals(true) consent!: boolean;
  @Transform(text)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  privacyPolicyVersion!: string;
}

export class AvailabilityQueryDto {
  @IsISO8601() from!: string;
  @IsISO8601() to!: string;
}

export class AppointmentListQueryDto {
  @IsOptional() @IsEnum(AppointmentStatus) status?: AppointmentStatus;
}

export class AvailabilityRuleDto {
  @IsInt() @Min(0) @Max(6) weekday!: number;
  @IsString() @Matches(TIME_OF_DAY, HH_MM) startTime!: string;
  @IsString() @Matches(TIME_OF_DAY, HH_MM) endTime!: string;
  @IsInt() @Min(5) @Max(240) durationMinutes = 30;
  @IsInt() @Min(0) @Max(120) bufferMinutes = 10;
  @IsBoolean() isActive = true;
}

export class AvailabilityExceptionDto {
  @IsISO8601() date!: string;
  @IsBoolean() isAvailable = false;
  @IsOptional() @IsString() @Matches(TIME_OF_DAY, HH_MM) startTime?: string;
  @IsOptional() @IsString() @Matches(TIME_OF_DAY, HH_MM) endTime?: string;
  @IsOptional() @IsString() @MaxLength(240) note?: string;
}

export class AppointmentStatusDto {
  @IsIn(Object.values(AppointmentStatus)) status!: AppointmentStatus;
}
