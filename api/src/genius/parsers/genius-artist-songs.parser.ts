import type { GeniusArtistSongs } from '../types/genius-artist-songs';
import { parseGeniusEnvelope } from './genius-validation';
import { parseGeniusSongSummary } from './genius-song-summary.parser';
import { isPositiveSafeInteger } from '../../upstream-validation';

export function parseGeniusArtistSongsResponse(
  value: unknown,
  page: number,
): GeniusArtistSongs | null {
  const response = parseGeniusEnvelope(value);
  if (
    !response ||
    !Array.isArray(response.songs) ||
    !(
      response.next_page === null ||
      (isPositiveSafeInteger(response.next_page) && response.next_page > page)
    )
  )
    return null;
  const songs: GeniusArtistSongs['songs'] = [];
  const seen = new Set<number>();
  for (const entry of response.songs) {
    const song = parseGeniusSongSummary(entry);
    if (!song || seen.has(song.id)) continue;
    seen.add(song.id);
    songs.push(song);
  }
  return { songs, next_page: response.next_page };
}
