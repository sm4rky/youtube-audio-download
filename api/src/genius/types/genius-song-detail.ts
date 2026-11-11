import type { GeniusAlbum, GeniusArtist } from './genius-entities';

// Detail is independent of search: each endpoint owns its validated contract.
export interface GeniusSongDetail {
  id: number;
  title: string;
  primary_artist: { name: string };
  primary_artists: GeniusArtist[];
  featured_artists: GeniusArtist[];
  release_date_components: { year: number } | null;
  song_art_image_url: string | null;
  song_art_image_thumbnail_url: string | null;
  header_image_url: string | null;
  url: string | null;
  album: GeniusAlbum | null;
  media: GeniusYouTubeMedia[];
}

export interface GeniusYouTubeMedia {
  provider: 'youtube';
  type: string | null;
  url: string;
  start: number | null;
}
