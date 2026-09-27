import { IsIn, IsOptional } from 'class-validator';
import { PageQueryDto } from '../../common/pagination/page-query.dto';

export type PostGroup = 'technical' | 'news';

export class PostQueryDto extends PageQueryDto {
  @IsOptional() @IsIn(['technical', 'news']) group?: PostGroup;
}
