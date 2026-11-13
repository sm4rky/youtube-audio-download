import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

function parseDigits({ value }: { value: unknown }): unknown {
  return typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : value;
}

export class PaginationQueryDto {
  @Transform(parseDigits)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  page = 1;

  @Transform(parseDigits)
  @IsInt()
  @Min(1)
  @Max(50)
  perPage = 20;
}
