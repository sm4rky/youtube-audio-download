import type {
  GeniusSongDetail,
  GeniusYouTubeMedia,
} from '../types/genius-song-detail';
import type { GeniusAlbum } from '../types/genius-entities';
import {
  parseGeniusEnvelope,
  parseArtists,
  parseReleaseYear,
  parseIsoReleaseYear,
  parseOptionalUrl,
} from './genius-validation';
import {
  isRecord,
  isPositiveSafeInteger,
  isNonemptyString,
} from '../../upstream-validation';

function parseAlbum(value: unknown): GeniusAlbum | null {
  if (
    !isRecord(value) ||
    !isPositiveSafeInteger(value.id) ||
    !isNonemptyString(value.name)
  )
    return null;
  return {
    id: value.id,
    name: value.name,
    cover_art_url: parseOptionalUrl(value.cover_art_url),
  };
}

function parseYouTubeMedia(value: unknown): GeniusYouTubeMedia[] {
  if (!Array.isArray(value)) return [];
  const media: GeniusYouTubeMedia[] = [];
  const seen = new Set<string>();
  const hosts = new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtu.be',
    'www.youtu.be',
  ]);
  for (const entry of value) {
    if (!isRecord(entry) || entry.provider !== 'youtube') continue;
    const href = parseOptionalUrl(entry.url);
    if (!href) continue;
    const url = new URL(href);
    if (
      url.protocol !== 'https:' ||
      !hosts.has(url.hostname) ||
      url.username ||
      url.password ||
      url.port ||
      seen.has(url.href)
    )
      continue;
    seen.add(url.href);
    media.push({
      provider: 'youtube',
      url: url.href,
      type: isNonemptyString(entry.type) ? entry.type : null,
      start:
        typeof entry.start === 'number' &&
        Number.isFinite(entry.start) &&
        entry.start >= 0
          ? entry.start
          : null,
    });
  }
  return media;
}

export function parseGeniusDetailResponse(
  value: unknown,
  expectedId: number,
): GeniusSongDetail | null {
  const response = parseGeniusEnvelope(value);
  const song = response?.song;
  if (
    !isRecord(song) ||
    !isPositiveSafeInteger(song.id) ||
    song.id !== expectedId ||
    !isNonemptyString(song.title) ||
    !isRecord(song.primary_artist) ||
    !isNonemptyString(song.primary_artist.name)
  )
    return null;
  const primaryArtists = parseArtists(song.primary_artists);
  return {
    id: song.id,
    title: song.title,
    primary_artist: { name: song.primary_artist.name },
    primary_artists: primaryArtists.length
      ? primaryArtists
      : parseArtists([song.primary_artist]),
    featured_artists: parseArtists(song.featured_artists),
    // The verified detail payload can use release_date instead of components.
    release_date_components:
      parseReleaseYear(song.release_date_components) ??
      parseIsoReleaseYear(song.release_date),
    song_art_image_url: parseOptionalUrl(song.song_art_image_url),
    song_art_image_thumbnail_url: parseOptionalUrl(
      song.song_art_image_thumbnail_url,
    ),
    header_image_url: parseOptionalUrl(song.header_image_url),
    url: parseOptionalUrl(song.url),
    album: parseAlbum(song.album),
    media: parseYouTubeMedia(song.media),
  };
}
