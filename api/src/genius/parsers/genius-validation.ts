import type { GeniusArtist } from '../types/genius-entities';
import {
  isRecord,
  isPositiveSafeInteger,
  isNonemptyString,
} from '../../upstream-validation';

export function parseGeniusEnvelope(
  value: unknown,
): Record<string, unknown> | null {
  if (
    !isRecord(value) ||
    !isRecord(value.meta) ||
    value.meta.status !== 200 ||
    !isRecord(value.response)
  )
    return null;
  return value.response;
}

export function parseOptionalUrl(value: unknown): string | null {
  if (!isNonemptyString(value)) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function parseArtists(value: unknown): GeniusArtist[] {
  if (!Array.isArray(value)) return [];
  const artists: GeniusArtist[] = [];
  const seen = new Set<number>();
  for (const artist of value) {
    if (
      !isRecord(artist) ||
      !isPositiveSafeInteger(artist.id) ||
      !isNonemptyString(artist.name) ||
      seen.has(artist.id)
    )
      continue;
    seen.add(artist.id);
    artists.push({ id: artist.id, name: artist.name });
  }
  return artists;
}

export function parseReleaseYear(components: unknown): { year: number } | null {
  const year = isRecord(components) ? components.year : null;
  return typeof year === 'number' &&
    Number.isInteger(year) &&
    year >= 1 &&
    year <= 9999
    ? { year }
    : null;
}

export function parseIsoReleaseYear(value: unknown): { year: number } | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    date.getUTCFullYear() <= 0
  )
    return null;
  return { year: date.getUTCFullYear() };
}
