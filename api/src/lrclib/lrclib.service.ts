import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseLrclibSearchResponse } from './parsers/lrclib-search.parser';
import type { LrclibRecord } from './types/lrclib-record';

function parseRetryAfter(value: string | null): number | undefined {
  if (value === null) return undefined;
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    const seconds = Number(text);
    return Number.isSafeInteger(seconds) ? seconds : undefined;
  }
  if (
    !/^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(text)
  )
    return undefined;
  const date = Date.parse(text);
  return Number.isFinite(date)
    ? Math.max(0, Math.ceil((date - Date.now()) / 1000))
    : undefined;
}

@Injectable()
export class LrclibService {
  private readonly logger = new Logger(LrclibService.name);

  constructor(private readonly config: ConfigService) {}

  async search(trackName: string, artistName: string): Promise<LrclibRecord[]> {
    const url = new URL('https://lrclib.net/api/search');
    url.searchParams.set('track_name', trackName);
    url.searchParams.set('artist_name', artistName);
    const name = this.config.getOrThrow<string>('LRCLIB_CLIENT_NAME');
    const version = this.config.getOrThrow<string>('LRCLIB_CLIENT_VERSION');
    const contact = this.config.getOrThrow<string>('LRCLIB_CLIENT_CONTACT');
    const client = `${name} v${version}${contact ? ` (${contact})` : ''}`;
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.getOrThrow<number>('LRCLIB_TIMEOUT_MS'),
    );

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': client },
        signal: controller.signal,
        redirect: 'error',
      });
      if (response.status === 429) {
        throw this.failure(
          HttpStatus.SERVICE_UNAVAILABLE,
          'LRCLIB_RATE_LIMITED',
          'LRCLIB is temporarily rate limited. Please try again later.',
          parseRetryAfter(response.headers.get('retry-after')),
        );
      }
      if (response.status !== 200) {
        throw this.upstreamError(
          response.status === 503
            ? parseRetryAfter(response.headers.get('retry-after'))
            : undefined,
        );
      }
      const contentType = response.headers
        .get('content-type')
        ?.split(';')[0]
        .trim()
        .toLowerCase();
      if (contentType !== 'application/json' && !contentType?.endsWith('+json'))
        throw this.upstreamError();

      // Keep the abort deadline active through response-body consumption.
      const body: unknown = await response.json();
      const records = parseLrclibSearchResponse(body);
      if (records === null) throw this.upstreamError();
      return records;
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      if (controller.signal.aborted) {
        throw this.failure(
          HttpStatus.GATEWAY_TIMEOUT,
          'LRCLIB_TIMEOUT',
          'LRCLIB lyrics search timed out. Please try again.',
        );
      }
      throw this.upstreamError();
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }

  private upstreamError(retryAfterSeconds?: number): HttpException {
    return this.failure(
      HttpStatus.BAD_GATEWAY,
      'LRCLIB_UPSTREAM_ERROR',
      'Unable to retrieve lyrics from LRCLIB.',
      retryAfterSeconds,
    );
  }

  private failure(
    statusCode: HttpStatus,
    code: string,
    message: string,
    retryAfterSeconds?: number,
  ): HttpException {
    this.logger.warn(`${code} (HTTP ${statusCode})`);
    return new HttpException(
      {
        statusCode,
        code,
        message,
        ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
      },
      statusCode,
    );
  }
}
