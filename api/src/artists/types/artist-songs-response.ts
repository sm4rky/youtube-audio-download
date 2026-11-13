import type { Pagination } from '@/common/pagination/pagination';
import type { SongSummary } from '@/songs/types/song-summary';
import type { GeniusArtistSongsSort } from '@/genius/types/genius-artist-songs';

export interface ArtistSongsResponse {
  artistId: number;
  sort: GeniusArtistSongsSort;
  pagination: Pagination;
  items: SongSummary[];
}
