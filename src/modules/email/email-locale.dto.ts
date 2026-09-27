import { IsIn, IsOptional } from 'class-validator';
import type { EmailLocale } from './email-template';

export class EmailLocaleDto {
  @IsOptional() @IsIn(['vi', 'en']) locale: EmailLocale = 'vi';
}
