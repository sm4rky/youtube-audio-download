import type { GeniusArtist } from './genius-entities';

// Validated search data, not a declaration of the complete upstream payload.
export interface GeniusSearchSong {
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
}
