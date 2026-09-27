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
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(180)
  location?: string;
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === '' ? undefined : Number(value),
  )
  @IsInt()
  @Min(1900)
  @Max(2200)
  year?: number;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    return (
      {
        'in delivery': 'in_progress',
        'in progress': 'in_progress',
        completed: 'completed',
        planned: 'planned',
        profiled: 'profiled',
      }[normalized] ?? normalized
    );
  })
  @IsIn(['profiled', 'planned', 'in_progress', 'completed'])
  status?: string;
}
