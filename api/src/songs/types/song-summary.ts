import type { SongArtist } from './song-entities';

export interface SongSummary {
  geniusId: number;
  title: string;
  artistName: string;
  year: number | null;
  primaryArtists: SongArtist[];
  featuredArtists: SongArtist[];
  coverUrl: string | null;
  geniusUrl: string | null;
}
