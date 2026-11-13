import type { GeniusSongSummary } from '../types/genius-song-summary';
import { parseGeniusEnvelope } from './genius-validation';
import { parseGeniusSongSummary } from './genius-song-summary.parser';
import { isRecord } from '@/common/upstream/upstream-validation';

// null means a malformed envelope; [] means a valid response with no songs.
export function parseGeniusSearchResponse(
  value: unknown,
): GeniusSongSummary[] | null {
  const response = parseGeniusEnvelope(value);
  if (!response || !Array.isArray(response.hits)) return null;
  const songs: GeniusSongSummary[] = [];
  const seen = new Set<number>();
  for (const hit of response.hits) {
    if (!isRecord(hit) || hit.type !== 'song') continue;
    const song = parseGeniusSongSummary(hit.result);
    if (!song || seen.has(song.id)) continue;
    seen.add(song.id);
    songs.push(song);
  }
  return songs;
}
