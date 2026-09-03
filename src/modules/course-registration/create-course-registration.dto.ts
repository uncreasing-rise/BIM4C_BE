import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  IsBoolean,
  Equals,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { normalizeEmail, normalizeText } from '../../common/utils/input';
export class CreateCourseRegistrationDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() courseId!: string;
  @ApiProperty({ example: 'Nguyen Van A' })
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;
  @ApiProperty({ example: 'a@example.com' })
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  @MaxLength(320)
  email!: string;
  @ApiProperty({ example: '0900000000' })
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @Matches(/^[+()\d\s.-]{8,32}$/)
  phone!: string;
  @ApiProperty({ example: true }) @IsBoolean() @Equals(true) consent!: boolean;
  @ApiProperty({ example: '20.08.2026' }) @Transform(({ value }) => normalizeText(value)) @IsString() @MinLength(1) @MaxLength(64) privacyPolicyVersion!: string;
}
