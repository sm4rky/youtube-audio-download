import type { GeniusSongSummary } from '../types/genius-song-summary';
import {
  parseArtists,
  parseReleaseYear,
  parseOptionalUrl,
} from './genius-validation';
import {
  isRecord,
  isPositiveSafeInteger,
  isNonemptyString,
} from '../../upstream-validation';

export function parseGeniusSongSummary(
  value: unknown,
): GeniusSongSummary | null {
  if (
    !isRecord(value) ||
    !isPositiveSafeInteger(value.id) ||
    !isNonemptyString(value.title) ||
    !isRecord(value.primary_artist) ||
    !isNonemptyString(value.primary_artist.name)
  )
    return null;
  const primaryArtists = parseArtists(value.primary_artists);
  return {
    id: value.id,
    title: value.title,
    primary_artist: { name: value.primary_artist.name },
    primary_artists: primaryArtists.length
      ? primaryArtists
      : parseArtists([value.primary_artist]),
    featured_artists: parseArtists(value.featured_artists),
    release_date_components: parseReleaseYear(value.release_date_components),
    song_art_image_url: parseOptionalUrl(value.song_art_image_url),
    song_art_image_thumbnail_url: parseOptionalUrl(
      value.song_art_image_thumbnail_url,
    ),
    header_image_url: parseOptionalUrl(value.header_image_url),
    url: parseOptionalUrl(value.url),
  };
}
