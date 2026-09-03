import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

@Injectable()
export class SlugPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (value.length > 180 || !SLUG_PATTERN.test(value))
      throw new BadRequestException('Invalid slug');
    return value;
  }
}
