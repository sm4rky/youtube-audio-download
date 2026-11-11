import type { GeniusSearchSong } from '../types/genius-search-song';
import {
  isRecord,
  isPositiveSafeInteger,
  isNonemptyString,
  parseGeniusEnvelope,
  parseArtists,
  parseReleaseYear,
  parseOptionalUrl,
} from './genius-validation';

function parseSearchSong(value: unknown): GeniusSearchSong | null {
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

// null means a malformed envelope; [] means a valid response with no songs.
export function parseGeniusSearchResponse(
  value: unknown,
): GeniusSearchSong[] | null {
  const response = parseGeniusEnvelope(value);
  if (!response || !Array.isArray(response.hits)) return null;
  const songs: GeniusSearchSong[] = [];
  for (const hit of response.hits) {
    if (!isRecord(hit) || hit.type !== 'song') continue;
    const song = parseSearchSong(hit.result);
    if (song) songs.push(song);
  }
  return songs;
}
