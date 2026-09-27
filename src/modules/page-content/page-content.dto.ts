import { IsObject } from 'class-validator';

export class UpdatePageContentDto {
  @IsObject() vi!: Record<string, unknown>;
  @IsObject() en!: Record<string, unknown>;
}
