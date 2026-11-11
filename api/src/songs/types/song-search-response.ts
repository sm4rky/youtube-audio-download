import type { SongArtist } from './song-entities';

export interface SongSearchItem {
  geniusId: number;
  title: string;
  artistName: string;
  year: number | null;
  primaryArtists: SongArtist[];
  featuredArtists: SongArtist[];
  coverUrl: string | null;
  geniusUrl: string | null;
}

export interface SongSearchResponse {
  query: string;
  items: SongSearchItem[];
}
