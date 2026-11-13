import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GeniusSongSummary } from './types/genius-song-summary';
import type { GeniusSongDetail } from './types/genius-song-detail';
import { parseGeniusSearchResponse } from './parsers/genius-search.parser';
import { parseGeniusDetailResponse } from './parsers/genius-detail.parser';
import { parseGeniusArtistSongsResponse } from './parsers/genius-artist-songs.parser';
import { parseGeniusAlbumTracksResponse } from './parsers/genius-album-tracks.parser';
import type {
  GeniusArtistSongs,
  GeniusArtistSongsSort,
} from './types/genius-artist-songs';
import type { GeniusAlbumTracks } from './types/genius-album-tracks';

type RequestContext = 'search' | 'song' | 'artist' | 'album';
const subjects: Record<RequestContext, string> = {
  search: 'Song search',
  song: 'Song metadata',
  artist: 'Artist songs',
  album: 'Album tracks',
};

@Injectable()
export class GeniusService {
  private readonly logger = new Logger(GeniusService.name);

  constructor(private readonly config: ConfigService) {}

  async search(query: string): Promise<GeniusSongSummary[]> {
    const url = new URL('https://api.genius.com/search');
    url.searchParams.set('q', query);
    const songs = parseGeniusSearchResponse(await this.request(url));
    if (songs === null) throw this.upstreamError();
    return songs;
  }

  async getDetail(id: number): Promise<GeniusSongDetail> {
    const response = await this.request(
      new URL(`https://api.genius.com/songs/${id}`),
      'song',
    );
    const song = parseGeniusDetailResponse(response, id);
    if (song === null) throw this.upstreamError('song');
    return song;
  }

  async getArtistSongs(
    id: number,
    page: number,
    perPage: number,
    sort: GeniusArtistSongsSort,
  ): Promise<GeniusArtistSongs> {
    const url = new URL(`https://api.genius.com/artists/${id}/songs`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(perPage));
    url.searchParams.set('sort', sort);
    const result = parseGeniusArtistSongsResponse(
      await this.request(url, 'artist'),
      page,
    );
    if (result === null) throw this.upstreamError('artist');
    return result;
  }

  async getAlbumTracks(
    id: number,
    page: number,
    perPage: number,
  ): Promise<GeniusAlbumTracks> {
    const url = new URL(`https://api.genius.com/albums/${id}/tracks`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(perPage));
    const result = parseGeniusAlbumTracksResponse(
      await this.request(url, 'album'),
      page,
    );
    if (result === null) throw this.upstreamError('album');
    return result;
  }

  private async request(
    url: URL,
    context: RequestContext = 'search',
  ): Promise<unknown> {
    const subject = subjects[context];
    const token = this.config.get<string>('GENIUS_ACCESS_TOKEN')?.trim();
    if (!token) {
      throw this.failure(
        HttpStatus.SERVICE_UNAVAILABLE,
        'GENIUS_NOT_CONFIGURED',
        `${subject} is not configured.`,
      );
    }

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
      if (context !== 'search' && response.status === 404) {
        throw this.failure(
          HttpStatus.NOT_FOUND,
          `${context.toUpperCase()}_NOT_FOUND`,
          `${context[0].toUpperCase() + context.slice(1)} was not found.`,
        );
      }
      if (response.status === 401 || response.status === 403) {
        throw this.failure(
          HttpStatus.SERVICE_UNAVAILABLE,
          'GENIUS_AUTH_FAILED',
          `${subject} authentication is unavailable.`,
        );
      }
      if (response.status === 429) {
        throw this.failure(
          HttpStatus.SERVICE_UNAVAILABLE,
          'GENIUS_RATE_LIMITED',
          `${subject} is temporarily rate limited. Please try again later.`,
        );
      }
      if (response.status !== 200) throw this.upstreamError(context);

      const contentType = response.headers
        .get('content-type')
        ?.split(';')[0]
        .trim()
        .toLowerCase();
      if (contentType !== 'application/json' && !contentType?.endsWith('+json'))
        throw this.upstreamError(context);

      // Keep the abort timer active until the entire body has been read.
      const body: unknown = await response.json();
      return body;
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      if (controller.signal.aborted) {
        throw this.failure(
          HttpStatus.GATEWAY_TIMEOUT,
          'GENIUS_TIMEOUT',
          `${subject} timed out. Please try again.`,
        );
      }
      throw this.upstreamError(context);
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }

  private upstreamError(context: RequestContext = 'search'): HttpException {
    return this.failure(
      HttpStatus.BAD_GATEWAY,
      'GENIUS_UPSTREAM_ERROR',
      `${subjects[context]} is temporarily unavailable.`,
    );
  }

  private failure(
    statusCode: HttpStatus,
    code: string,
    message: string,
  ): HttpException {
    // Never log the token, query, raw upstream response, or caught error object.
    this.logger.warn(`${code} (HTTP ${statusCode})`);
    return new HttpException({ statusCode, code, message }, statusCode);
  }
}
