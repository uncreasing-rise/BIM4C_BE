import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { normalizeEmail, normalizeText } from '../../common/utils/input';
export class CreateContactDto {
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
  @ApiPropertyOptional({ example: '0900000000' })
  @IsOptional()
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MaxLength(32)
  phone?: string;
  @ApiPropertyOptional({ example: 'BIM4C' })
  @IsOptional()
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MaxLength(200)
  company?: string;
  @ApiProperty({ example: 'Noi dung lien he voi BIM4C' })
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  message!: string;
}
