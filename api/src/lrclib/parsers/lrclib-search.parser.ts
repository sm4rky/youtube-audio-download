import type { LrclibRecord } from '../types/lrclib-record';
import {
  isRecord,
  isPositiveSafeInteger,
  isNonemptyString,
} from '../../upstream-validation';

function parseRecord(value: unknown): LrclibRecord | null {
  if (
    !isRecord(value) ||
    !isPositiveSafeInteger(value.id) ||
    !isNonemptyString(value.trackName) ||
    !isNonemptyString(value.artistName) ||
    typeof value.instrumental !== 'boolean'
  ) {
    return null;
  }

  const album = value.albumName;
  const duration = value.duration;
  const plain = value.plainLyrics;
  const synced = value.syncedLyrics;
  if (
    (album != null && typeof album !== 'string') ||
    (duration != null &&
      (typeof duration !== 'number' ||
        !Number.isFinite(duration) ||
        duration <= 0)) ||
    (plain !== null && typeof plain !== 'string') ||
    (synced !== null && typeof synced !== 'string')
  ) {
    return null;
  }

  return {
    id: value.id,
    trackName: value.trackName,
    artistName: value.artistName,
    albumName: typeof album === 'string' ? album : null,
    duration: typeof duration === 'number' ? duration : null,
    instrumental: value.instrumental,
    plainLyrics: plain,
    syncedLyrics: synced,
  };
}

// A malformed envelope is different from a valid search without usable records.
export function parseLrclibSearchResponse(
  value: unknown,
): LrclibRecord[] | null {
  if (!Array.isArray(value)) return null;
  const records: LrclibRecord[] = [];
  const seen = new Set<number>();
  for (const entry of value) {
    const record = parseRecord(entry);
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    records.push(record);
  }
  return records;
}
