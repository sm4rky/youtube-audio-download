import type { GeniusSearchSong } from '../types/genius-search-song';
import { parseGeniusEnvelope } from './genius-validation';
import { parseGeniusSongSummary } from './genius-song-summary.parser';
import { isRecord } from '../../upstream-validation';

// null means a malformed envelope; [] means a valid response with no songs.
export function parseGeniusSearchResponse(
  value: unknown,
): GeniusSearchSong[] | null {
  const response = parseGeniusEnvelope(value);
  if (!response || !Array.isArray(response.hits)) return null;
  const songs: GeniusSearchSong[] = [];
  for (const hit of response.hits) {
    if (!isRecord(hit) || hit.type !== 'song') continue;
    const song = parseGeniusSongSummary(hit.result);
    if (song) songs.push(song);
  }
  return songs;
}
