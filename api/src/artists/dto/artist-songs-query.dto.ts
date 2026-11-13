import { IsIn } from 'class-validator';
import { PaginationQueryDto } from '@/common/http/pagination-query.dto';
import type { GeniusArtistSongsSort } from '@/genius/types/genius-artist-songs';

export class ArtistSongsQueryDto extends PaginationQueryDto {
  @IsIn(['popularity', 'title'])
  sort: GeniusArtistSongsSort = 'popularity';
}
