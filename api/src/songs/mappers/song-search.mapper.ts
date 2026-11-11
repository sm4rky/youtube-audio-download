import type { GeniusSearchSong } from '../../genius/types/genius-search-song';
import type {
  SongSearchItem,
  SongSearchResponse,
} from '../types/song-search-response';

export function mapSongSearchResponse(
  query: string,
  songs: GeniusSearchSong[],
): SongSearchResponse {
  const seen = new Set<number>();
  const items: SongSearchItem[] = [];
  for (const song of songs) {
    if (seen.has(song.id)) continue;
    seen.add(song.id);
    items.push({
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
    });
  }
  return { query, items };
}
