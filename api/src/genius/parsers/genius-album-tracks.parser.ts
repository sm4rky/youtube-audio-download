import type {
  GeniusAlbumTracks,
  GeniusAlbumTrack,
} from '../types/genius-album-tracks';
import { parseGeniusEnvelope } from './genius-validation';
import { parseGeniusSongSummary } from './genius-song-summary.parser';
import {
  isRecord,
  isPositiveSafeInteger,
} from '@/common/upstream/upstream-validation';

export function parseGeniusAlbumTracksResponse(
  value: unknown,
  page: number,
): GeniusAlbumTracks | null {
  const response = parseGeniusEnvelope(value);
  if (
    !response ||
    !Array.isArray(response.tracks) ||
    !(
      response.next_page === null ||
      (isPositiveSafeInteger(response.next_page) && response.next_page > page)
    )
  )
    return null;
  const tracks: GeniusAlbumTrack[] = [];
  for (const entry of response.tracks) {
    if (!isRecord(entry)) continue;
    const song = parseGeniusSongSummary(entry.song);
    if (!song) continue;
    tracks.push({
      disc_track_number: isPositiveSafeInteger(entry.disc_track_number)
        ? entry.disc_track_number
        : null,
      disc_number: isPositiveSafeInteger(entry.disc_number)
        ? entry.disc_number
        : null,
      song,
    });
  }
  return { tracks, next_page: response.next_page };
}
