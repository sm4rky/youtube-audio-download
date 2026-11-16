import type { SyncedLyricLine } from '../types/lyrics.ts';

// Expand repeated timestamps and preserve empty timed entries before sorting stably.
export function parseSyncedLyrics(lrc: string | null): SyncedLyricLine[] {
  if (!lrc) return [];
  const lines: SyncedLyricLine[] = [];
  for (const [lineIndex, rawLine] of lrc.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    const timestamps = [...line.matchAll(/\[(\d+):([0-5]\d)(?:[.:](\d{1,3}))?\]/g)];
    let position = 0;
    const timedEntries: SyncedLyricLine[] = [];
    for (const [timestampIndex, timestamp] of timestamps.entries()) {
      // Only accept consecutive timestamp tags at the beginning of a line.
      if (timestamp.index !== position) break;
      const timeMs = Number(timestamp[1]) * 60_000 + Number(timestamp[2]) * 1000 +
        Number((timestamp[3] ?? '').padEnd(3, '0'));
      if (!Number.isSafeInteger(timeMs)) break;
      position += timestamp[0].length;
      timedEntries.push({ id: `${lineIndex}-${timestampIndex}`, timeMs, text: '' });
    }
    const text = line.slice(position).trim();
    for (const entry of timedEntries) lines.push({ ...entry, text });
  }
  return lines.sort((left, right) => left.timeMs - right.timeMs);
}

// Find the last timestamp at or before the actual playback position, including gaps.
export function findActiveLyricIndex(lines: readonly SyncedLyricLine[], timeMs: number): number {
  if (!Number.isFinite(timeMs)) return -1;
  let low = 0;
  let high = lines.length - 1;
  let active = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (lines[middle].timeMs <= timeMs) {
      active = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return active;
}
