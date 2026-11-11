import type { SongAlbum, SongArtist } from './song-entities';

export interface SongDetailResponse {
  geniusId: number;
  title: string;
  artistName: string;
  primaryArtists: SongArtist[];
  featuredArtists: SongArtist[];
  year: number | null;
  album: SongAlbum | null;
  coverUrl: string | null;
  geniusUrl: string | null;
  media: SongYouTubeMedia[];
}

export interface SongYouTubeMedia {
  provider: 'youtube';
  type: string | null;
  url: string;
  start: number | null;
}
