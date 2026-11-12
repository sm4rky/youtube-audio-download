import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class SearchLyricsQueryDto {
  @Transform(trimString)
  @IsString()
  @Length(1, 200)
  title!: string;

  @Transform(trimString)
  @IsString()
  @Length(1, 200)
  artist!: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @Length(1, 200)
  album?: string;

  @Transform(({ value }: { value: unknown }) => {
    if (
      typeof value !== 'string' ||
      !/^[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())
    )
      return value;
    return Number(value);
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(Number.MIN_VALUE)
  duration?: number;
}
