// Only the upstream fields used by search, after runtime validation.
export interface GeniusSong {
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
export interface GeniusArtist {
  id: number;
  name: string;
}
