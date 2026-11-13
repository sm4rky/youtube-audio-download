import { mapSongSummary } from './song-summary.mapper';
import type { GeniusSongSummary } from '@/genius/types/genius-song-summary';
import type { SongSearchResponse } from '../types/song-search-response';

export function mapSongSearchResponse(
  query: string,
  songs: GeniusSongSummary[],
): SongSearchResponse {
  return { query, items: songs.map(mapSongSummary) };
}
