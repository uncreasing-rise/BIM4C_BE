import 'reflect-metadata';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EmailLocaleDto } from '../email/email-locale.dto';
import { EVENT_TYPES, type EventType } from './analytics.utils';

export class AnalyticsEventDto {
  @IsIn(EVENT_TYPES) type!: EventType;
  @IsString() @MaxLength(1000) @Matches(/^\//) path!: string;
  /** Random id of the browser tab's visit (sessionStorage), not a cookie. */
  @IsString() @MaxLength(40) @Matches(/^[A-Za-z0-9-]+$/) sessionId!: string;
  @IsOptional() @IsIn(['vi', 'en']) locale?: 'vi' | 'en';
  /** Link, file or phone the click went to; the search term for "search". */
  @IsOptional() @IsString() @MaxLength(1000) target?: string;
  /** Visible text of what was clicked, or the form name for "form_submit". */
  @IsOptional() @IsString() @MaxLength(200) label?: string;
  @IsOptional() @IsString() @MaxLength(1000) referrer?: string;
  @IsOptional() @IsString() @MaxLength(100) utmSource?: string;
  @IsOptional() @IsString() @MaxLength(100) utmMedium?: string;
  @IsOptional() @IsString() @MaxLength(200) utmCampaign?: string;
  /** Visible time on the page ("engagement"), in ms. */
  @IsOptional() @IsInt() @Min(0) @Max(86_400_000) durationMs?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) scrollDepth?: number;
}

export class TrackEventsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => AnalyticsEventDto)
  events!: AnalyticsEventDto[];
}

/**
 * How a lead found the site, sent with a form: kept for the session only in
 * the visitor's browser and submitted together with what they typed.
 */
export class LeadAttributionDto {
  @IsOptional() @IsString() @MaxLength(1000) referrer?: string;
  @IsOptional() @IsString() @MaxLength(100) utmSource?: string;
  @IsOptional() @IsString() @MaxLength(100) utmMedium?: string;
  @IsOptional() @IsString() @MaxLength(200) utmCampaign?: string;
  @IsOptional() @IsString() @MaxLength(500) landingPage?: string;
  /** The last pages viewed before sending, oldest first. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  pages?: string[];
  @IsOptional() @IsString() @MaxLength(40) sessionId?: string;
}

/** Public form payloads: locale for the emails, plus the visit's attribution. */
export class PublicFormDto extends EmailLocaleDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => LeadAttributionDto)
  attribution?: LeadAttributionDto;
}

export class AnalyticsRangeDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) from!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) to!: string;
}
