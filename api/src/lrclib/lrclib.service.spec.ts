import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { HttpException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LrclibService } from './lrclib.service';

const record = {
  id: 123,
  trackName: 'Original Song',
  artistName: 'Original Artist',
  albumName: 'Album',
  duration: 210,
  instrumental: false,
  plainLyrics: 'Original text\n',
  syncedLyrics: '[00:01.00] Different original text\n',
};

describe('LrclibService HTTP boundary', () => {
  let service: LrclibService;
  let fetchMock: jest.Spied<typeof fetch>;
  let warn: jest.Spied<Logger['warn']>;
  beforeEach(() => {
    service = new LrclibService(
      new ConfigService({
        LRCLIB_TIMEOUT_MS: 50,
        LRCLIB_CLIENT_NAME: 'AudioMint',
        LRCLIB_CLIENT_VERSION: '0.1.0',
        LRCLIB_CLIENT_CONTACT: 'https://example.com/audiomint',
        GENIUS_ACCESS_TOKEN: 'synthetic-do-not-forward',
      }),
    );
    fetchMock = jest.spyOn(globalThis, 'fetch');
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  async function failure(code: string, statusCode: number): Promise<void> {
    try {
      await service.search('Original Song', 'Original Artist');
      throw new Error('Expected failure');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(HttpException);
      if (!(error instanceof HttpException)) throw error;
      expect(error.getStatus()).toBe(statusCode);
      expect(error.getResponse()).toMatchObject({
        statusCode,
        code,
        message: expect.any(String),
      });
      expect(JSON.stringify(error.getResponse())).not.toContain(
        'private upstream diagnostic',
      );
    }
  }

  it('makes exactly one v1 search request, encodes Unicode and identifies AudioMint without Genius credentials', async () => {
    fetchMock.mockResolvedValue(Response.json([record]));
    const title = 'Đừng hỏi em & live + #?';
    const artist = '가수 / Artista';
    await expect(service.search(title, artist)).resolves.toEqual([record]);
    const [input, options] = fetchMock.mock.calls[0];
    if (!(input instanceof URL)) throw new Error('Expected URL');
    expect(input.origin + input.pathname).toBe('https://lrclib.net/api/search');
    expect([...input.searchParams]).toEqual([
      ['track_name', title],
      ['artist_name', artist],
    ]);
    expect(options?.headers).toEqual({
      Accept: 'application/json',
      'User-Agent': 'AudioMint v0.1.0 (https://example.com/audiomint)',
    });
    expect(options?.redirect).toBe('error');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns a valid empty response', async () => {
    fetchMock.mockResolvedValue(Response.json([]));
    await expect(
      service.search('Original Song', 'Original Artist'),
    ).resolves.toEqual([]);
  });

  it('maps 429 and exposes validated Retry-After seconds without retrying', async () => {
    fetchMock.mockResolvedValue(
      new Response('private upstream diagnostic', {
        status: 429,
        headers: { 'retry-after': '60' },
      }),
    );
    await expect(service.search('Song', 'Artist')).rejects.toMatchObject({
      status: 503,
      response: { code: 'LRCLIB_RATE_LIMITED', retryAfterSeconds: 60 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('LRCLIB_RATE_LIMITED (HTTP 503)');
  });

  it('preserves a Retry-After HTTP date for a busy upstream', async () => {
    const now = Date.UTC(2026, 10, 12, 12);
    jest.spyOn(Date, 'now').mockReturnValue(now);
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 503,
        headers: { 'retry-after': new Date(now + 30000).toUTCString() },
      }),
    );
    await expect(service.search('Song', 'Artist')).rejects.toMatchObject({
      status: 502,
      response: { code: 'LRCLIB_UPSTREAM_ERROR', retryAfterSeconds: 30 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('omits malformed Retry-After instead of forwarding raw headers', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 429,
        headers: { 'retry-after': 'private upstream diagnostic' },
      }),
    );
    try {
      await service.search('Song', 'Artist');
      throw new Error('Expected failure');
    } catch (error: unknown) {
      if (!(error instanceof HttpException)) throw error;
      expect(error.getResponse()).not.toHaveProperty('retryAfterSeconds');
    }
  });

  it.each([201, 204, 301, 400, 401, 404, 500, 503])(
    'maps unexpected upstream HTTP %s without parsing its body or retrying',
    async (status) => {
      fetchMock.mockResolvedValue(new Response(null, { status }));
      await failure('LRCLIB_UPSTREAM_ERROR', 502);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('maps network errors to a safe upstream error', async () => {
    fetchMock.mockRejectedValue(new Error('private upstream diagnostic'));
    await failure('LRCLIB_UPSTREAM_ERROR', 502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('LRCLIB_UPSTREAM_ERROR (HTTP 502)');
  });

  it('rejects malformed JSON', async () => {
    fetchMock.mockResolvedValue(
      new Response('not JSON', {
        headers: { 'content-type': 'application/json' },
      }),
    );
    await failure('LRCLIB_UPSTREAM_ERROR', 502);
  });

  it.each([null, {}, { items: [] }, 'invalid'])(
    'rejects malformed top-level schema %#',
    async (value) => {
      fetchMock.mockResolvedValue(Response.json(value));
      await failure('LRCLIB_UPSTREAM_ERROR', 502);
    },
  );

  it.each(['text/html', 'text/plain', ''])(
    'rejects invalid/missing response content type %#',
    async (contentType) => {
      fetchMock.mockResolvedValue(
        new Response('[]', {
          headers: contentType ? { 'content-type': contentType } : {},
        }),
      );
      await failure('LRCLIB_UPSTREAM_ERROR', 502);
    },
  );

  it('aborts a pending request when the deadline expires', async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    fetchMock.mockImplementation((_input, options) => {
      signal = options?.signal;
      return new Promise((_resolve, reject) =>
        signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        ),
      );
    });
    const result = failure('LRCLIB_TIMEOUT', 504);
    await jest.advanceTimersByTimeAsync(50);
    await result;
    expect(signal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps the timeout active until the response body is consumed', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation((_input, options) =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('['));
              options?.signal?.addEventListener('abort', () =>
                controller.error(new DOMException('Aborted', 'AbortError')),
              );
            },
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    const result = failure('LRCLIB_TIMEOUT', 504);
    await jest.advanceTimersByTimeAsync(50);
    await result;
    expect(jest.getTimerCount()).toBe(0);
  });
});
