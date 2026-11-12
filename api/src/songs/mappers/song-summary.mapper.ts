import type { GeniusSongSummary } from '../../genius/types/genius-song-summary';
import type { SongSummary } from '../types/song-summary';

export function mapSongSummary(song: GeniusSongSummary): SongSummary {
  return {
    geniusId: song.id,
    title: song.title,
    artistName: song.primary_artist.name,
    year: song.release_date_components?.year ?? null,
    primaryArtists: song.primary_artists.map((artist) => ({
      geniusId: artist.id,
      name: artist.name,
    })),
    featuredArtists: song.featured_artists.map((artist) => ({
      geniusId: artist.id,
      name: artist.name,
    })),
    coverUrl:
      song.song_art_image_url ??
      song.song_art_image_thumbnail_url ??
      song.header_image_url,
    geniusUrl: song.url,
  };
}
