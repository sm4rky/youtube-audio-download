import type { GeniusSongSummary } from './genius-song-summary';

export type GeniusArtistSongsSort = 'popularity' | 'title';

export interface GeniusArtistSongs {
  songs: GeniusSongSummary[];
  next_page: number | null;
}
