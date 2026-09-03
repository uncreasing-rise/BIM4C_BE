import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { normalizeEmail, normalizeText } from '../../common/utils/input';
export class CreateNewsletterSubscriptionDto {
  @ApiProperty({ example: 'a@example.com' })
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  @MaxLength(320)
  email!: string;
  @ApiProperty({ example: true }) @IsBoolean() @Equals(true) consent!: boolean;
  @ApiProperty({ example: '20.08.2026' }) @Transform(({ value }) => normalizeText(value)) @IsString() @MinLength(1) @MaxLength(64) privacyPolicyVersion!: string;
}
