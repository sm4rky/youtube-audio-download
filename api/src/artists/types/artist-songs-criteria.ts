import type { GeniusArtistSongsSort } from '@/genius/types/genius-artist-songs';

export interface ArtistSongsCriteria {
  page: number;
  perPage: number;
  sort: GeniusArtistSongsSort;
}
