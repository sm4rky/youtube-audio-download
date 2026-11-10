import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GeniusArtist, GeniusSong } from './types/genius-song';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function parseArtists(value: unknown): GeniusArtist[] {
  if (!Array.isArray(value)) return [];
  const artists: GeniusArtist[] = [];
  const seen = new Set<number>();
  for (const artist of value) {
    if (
      !isRecord(artist) ||
      typeof artist.id !== 'number' ||
      !Number.isSafeInteger(artist.id) ||
      artist.id <= 0 ||
      typeof artist.name !== 'string' ||
      !artist.name.trim() ||
      seen.has(artist.id)
    )
      continue;
    seen.add(artist.id);
    artists.push({ id: artist.id, name: artist.name });
  }
  return artists;
}

function parseSong(hit: unknown): GeniusSong | null {
  if (!isRecord(hit) || hit.type !== 'song' || !isRecord(hit.result))
    return null;
  const result = hit.result;
  if (
    typeof result.id !== 'number' ||
    !Number.isSafeInteger(result.id) ||
    result.id <= 0 ||
    typeof result.title !== 'string' ||
    !result.title.trim() ||
    !isRecord(result.primary_artist) ||
    typeof result.primary_artist.name !== 'string' ||
    !result.primary_artist.name.trim()
  )
    return null;

  const primaryArtists = parseArtists(result.primary_artists);
  const year = isRecord(result.release_date_components)
    ? result.release_date_components.year
    : null;

  return {
    id: result.id,
    title: result.title,
    primary_artist: { name: result.primary_artist.name },
    primary_artists: primaryArtists.length
      ? primaryArtists
      : parseArtists([result.primary_artist]),
    featured_artists: parseArtists(result.featured_artists),
    release_date_components:
      typeof year === 'number' &&
      Number.isInteger(year) &&
      year >= 1 &&
      year <= 9999
        ? { year }
        : null,
    song_art_image_url: optionalUrl(result.song_art_image_url),
    song_art_image_thumbnail_url: optionalUrl(
      result.song_art_image_thumbnail_url,
    ),
    header_image_url: optionalUrl(result.header_image_url),
    url: optionalUrl(result.url),
  };
}

@Injectable()
export class GeniusService {
  private readonly logger = new Logger(GeniusService.name);

  constructor(private readonly config: ConfigService) {}

  async search(query: string): Promise<GeniusSong[]> {
    const token = this.config.get<string>('GENIUS_ACCESS_TOKEN')?.trim();
    if (!token) {
      throw this.failure(
        HttpStatus.SERVICE_UNAVAILABLE,
        'GENIUS_NOT_CONFIGURED',
        'Song search is not configured.',
      );
    }

    const url = new URL('https://api.genius.com/search');
    url.searchParams.set('q', query);
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.getOrThrow<number>('GENIUS_TIMEOUT_MS'),
    );
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
        redirect: 'error',
      });
      if (response.status === 401 || response.status === 403) {
        throw this.failure(
          HttpStatus.SERVICE_UNAVAILABLE,
          'GENIUS_AUTH_FAILED',
          'Song search authentication is unavailable.',
        );
      }
      if (response.status === 429) {
        throw this.failure(
          HttpStatus.SERVICE_UNAVAILABLE,
          'GENIUS_RATE_LIMITED',
          'Song search is temporarily rate limited. Please try again later.',
        );
      }
      if (response.status !== 200) throw this.upstreamError();

      // Keep the abort timer active until the entire body has been read.
      const body: unknown = await response.json();
      if (
        !isRecord(body) ||
        !isRecord(body.meta) ||
        body.meta.status !== 200 ||
        !isRecord(body.response) ||
        !Array.isArray(body.response.hits)
      )
        throw this.upstreamError();

      const songs: GeniusSong[] = [];
      for (const hit of body.response.hits) {
        const song = parseSong(hit);
        if (song) songs.push(song);
      }
      return songs;
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      if (controller.signal.aborted) {
        throw this.failure(
          HttpStatus.GATEWAY_TIMEOUT,
          'GENIUS_TIMEOUT',
          'Song search timed out. Please try again.',
        );
      }
      throw this.upstreamError();
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }

  private upstreamError() {
    return this.failure(
      HttpStatus.BAD_GATEWAY,
      'GENIUS_UPSTREAM_ERROR',
      'Song search is temporarily unavailable.',
    );
  }

  private failure(statusCode: HttpStatus, code: string, message: string) {
    // Never log the token, query, raw upstream response, or caught error object.
    this.logger.warn(`${code} (HTTP ${statusCode})`);
    return new HttpException({ statusCode, code, message }, statusCode);
  }
}
