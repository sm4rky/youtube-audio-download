import { mapSongSummary } from './song-summary.mapper';
import type { GeniusSearchSong } from '../../genius/types/genius-search-song';
import type { SongSearchResponse } from '../types/song-search-response';
import type { SongSummary } from '../types/song-summary';

export function mapSongSearchResponse(
  query: string,
  songs: GeniusSearchSong[],
): SongSearchResponse {
  const seen = new Set<number>();
  const items: SongSummary[] = [];
  for (const song of songs) {
    if (seen.has(song.id)) continue;
    seen.add(song.id);
    items.push(mapSongSummary(song));
  }
  return { query, items };
}
