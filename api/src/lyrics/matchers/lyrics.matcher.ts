import type { LrclibRecord } from '../../lrclib/types/lrclib-record';
import type { LyricsSearchCriteria } from '../types/lyrics-search-response';

function normalize(value: string): string {
  return value.normalize('NFC').toLowerCase().replace(/\s+/gu, ' ').trim();
}

function matchesAlbum(
  record: LrclibRecord,
  criteria: LyricsSearchCriteria,
): boolean {
  return (
    criteria.album !== null &&
    record.albumName !== null &&
    normalize(record.albumName) === normalize(criteria.album)
  );
}

function durationDifference(
  record: LrclibRecord,
  criteria: LyricsSearchCriteria,
): number {
  if (criteria.duration === null) return 0;
  return record.duration === null
    ? Infinity
    : Math.abs(record.duration - criteria.duration);
}

function hasBothLyrics(record: LrclibRecord): boolean {
  return Boolean(record.plainLyrics?.length && record.syncedLyrics?.length);
}

function isBetter(
  candidate: LrclibRecord,
  current: LrclibRecord,
  criteria: LyricsSearchCriteria,
): boolean {
  const candidateAlbum = matchesAlbum(candidate, criteria);
  const currentAlbum = matchesAlbum(current, criteria);
  if (candidateAlbum !== currentAlbum) return candidateAlbum;

  const candidateDuration = durationDifference(candidate, criteria);
  const currentDuration = durationDifference(current, criteria);
  if (candidateDuration !== currentDuration)
    return candidateDuration < currentDuration;

  return hasBothLyrics(candidate) && !hasBothLyrics(current);
}

export function selectBestLyricsMatch(
  candidates: LrclibRecord[],
  criteria: LyricsSearchCriteria,
): LrclibRecord | null {
  const title = normalize(criteria.title);
  const artist = normalize(criteria.artist);
  let selected: LrclibRecord | null = null;
  for (const candidate of candidates) {
    if (
      normalize(candidate.trackName) !== title ||
      normalize(candidate.artistName) !== artist
    )
      continue;
    if (selected === null || isBetter(candidate, selected, criteria))
      selected = candidate;
  }
  return selected;
}
