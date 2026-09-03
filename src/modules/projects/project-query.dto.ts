import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
export class ProjectQueryDto extends PageQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(180)
  location?: string;
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1900)
  @Max(2200)
  year?: number;
  @IsOptional() @IsIn(['planned', 'in_progress', 'completed']) status?: string;
}
