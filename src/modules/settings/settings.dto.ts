import {
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** An absolute http(s) URL, or a path on the site such as /images/og.webp. */
export const SITE_URL_OR_PATH = /^(https?:\/\/\S+|\/(?!\/)\S*)$/;

export class UpdateSettingsDto {
  @IsString() @MinLength(2) @MaxLength(200) companyName!: string;
  @IsEmail() @MaxLength(320) email!: string;
  @IsOptional() @IsString() @MaxLength(32) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(500) address?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) brochureUrl?: string | null;
  @IsOptional() metrics?: unknown;
  @IsObject() socialLinks!: Record<string, string>;
  @IsString() @MinLength(2) @MaxLength(240) defaultSeoTitle!: string;
  @IsString() @MinLength(10) @MaxLength(500) defaultSeoDescription!: string;
  @IsOptional() @IsString() @MaxLength(240) defaultSeoTitle_vi?: string | null;
  @IsOptional() @IsString() @MaxLength(500) defaultSeoDescription_vi?: string | null;
  @IsOptional()
  // The site resolves relative paths against its own origin (metadataBase),
  // and the stored default is one, so a path must save as well as a URL.
  @Matches(SITE_URL_OR_PATH, {
    message: 'defaultOgImage must be an http(s) URL or a path starting with /',
  })
  @MaxLength(1000)
  defaultOgImage?: string | null;
}
