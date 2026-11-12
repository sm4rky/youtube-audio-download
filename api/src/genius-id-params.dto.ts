import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class GeniusIdParamsDto {
  // Validate the original digit string before converting: a primitive numeric
  // route parameter would let Nest coerce values such as "+1" before validation.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : undefined,
  )
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  id!: number;
}
