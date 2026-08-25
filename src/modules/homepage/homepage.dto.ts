import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, MaxLength, Min, MinLength } from 'class-validator';
export class CreateHeroSlideDto { @IsString() @MinLength(2) @MaxLength(160) eyebrow!:string; @IsString() @MinLength(2) @MaxLength(240) title!:string; @IsString() @MinLength(2) @MaxLength(500) image!:string; @IsString() @MinLength(2) @MaxLength(240) alt!:string; @IsInt() @Min(0) sortOrder!:number; @IsBoolean() isActive!:boolean }
export class UpdateHeroSlideDto extends PartialType(CreateHeroSlideDto) {}
export class CreatePartnerDto { @IsString() @MinLength(2) @MaxLength(180) name!:string; @IsString() @MinLength(2) @MaxLength(500) logo!:string; @IsOptional() @IsUrl() @MaxLength(500) website?:string; @IsInt() @Min(0) sortOrder!:number; @IsBoolean() isActive!:boolean }
export class UpdatePartnerDto extends PartialType(CreatePartnerDto) {}
