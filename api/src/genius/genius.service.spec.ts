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
import { randomUUID } from 'node:crypto';
import { GeniusService } from './genius.service';

const songHit = {
  type: 'song',
  result: {
    id: 123,
    title: 'Hello',
    primary_artist: { name: 'Adele' },
    song_art_image_url: 'https://images.genius.com/cover.jpg',
    url: 'https://genius.com/Adele-hello-lyrics',
  },
};
const envelope = (hits: unknown[]) => ({
  meta: { status: 200 },
  response: { hits },
});

describe('GeniusService HTTP boundary', () => {
  let service: GeniusService;
  let fetchMock: jest.Spied<typeof fetch>;
  let warn: jest.Spied<Logger['warn']>;
  // Generate a throwaway value: tests never load or need a real access token.
  let credential: string;

  beforeEach(() => {
    credential = randomUUID();
    service = new GeniusService(
      new ConfigService({
        GENIUS_ACCESS_TOKEN: credential,
        GENIUS_TIMEOUT_MS: 50,
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

  async function expectFailure(code: string, statusCode: number) {
    try {
      await service.search('Hello');
      throw new Error('Expected the request to fail.');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(HttpException);
      if (!(error instanceof HttpException)) throw error;
      expect(error.getStatus()).toBe(statusCode);
      expect(error.getResponse()).toEqual({
        statusCode,
        code,
        message: expect.any(String),
      });
      expect(JSON.stringify(error.getResponse())).not.toContain(credential);
    }
  }

  it('uses the fixed endpoint, encoded query and Bearer authentication', async () => {
    fetchMock.mockResolvedValue(Response.json(envelope([songHit])));
    const query = 'Đừng hỏi em live & remix + #? / cover';
    const result = await service.search(query);
    const [input, options] = fetchMock.mock.calls[0];
    expect(input).toBeInstanceOf(URL);
    if (!(input instanceof URL)) throw new Error('Expected a URL instance.');
    const url = input;
    expect(url.origin + url.pathname).toBe('https://api.genius.com/search');
    expect([...url.searchParams]).toEqual([['q', query]]);
    expect(url.href).not.toContain(credential);
    expect(options?.headers).toEqual({
      Authorization: `Bearer ${credential}`,
      Accept: 'application/json',
    });
    expect(options?.redirect).toBe('error');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result[0]).toMatchObject({
      id: 123,
      title: 'Hello',
      primary_artist: { name: 'Adele' },
    });
  });

  it('rejects missing configuration before making any HTTP request', async () => {
    service = new GeniusService(
      new ConfigService({ GENIUS_ACCESS_TOKEN: '   ' }),
    );
    await expectFailure('GENIUS_NOT_CONFIGURED', 503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([401, 403])(
    'maps upstream HTTP %s to backend authentication failure',
    async (status) => {
      fetchMock.mockResolvedValue(
        new Response('untrusted upstream body', { status }),
      );
      await expectFailure('GENIUS_AUTH_FAILED', 503);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('distinguishes the shared upstream rate limit', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 429 }));
    await expectFailure('GENIUS_RATE_LIMITED', 503);
  });

  it.each([201, 204, 301, 400, 404, 500, 503])(
    'maps unexpected HTTP %s to an upstream error',
    async (status) => {
      fetchMock.mockResolvedValue(new Response(null, { status }));
      await expectFailure('GENIUS_UPSTREAM_ERROR', 502);
    },
  );

  it('maps network errors without exposing their details or retrying', async () => {
    fetchMock.mockRejectedValue(
      new Error(`untrusted diagnostic ${credential}`),
    );
    await expectFailure('GENIUS_UPSTREAM_ERROR', 502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('GENIUS_UPSTREAM_ERROR (HTTP 502)');
  });

  it('rejects invalid JSON', async () => {
    fetchMock.mockResolvedValue(
      new Response('not JSON', {
        headers: { 'content-type': 'application/json' },
      }),
    );
    await expectFailure('GENIUS_UPSTREAM_ERROR', 502);
  });

  describe.each(['search', 'detail'] as const)(
    '%s response content type',
    (operation) => {
      const body = {
        meta: { status: 200 },
        response: { hits: [songHit], song: songHit.result },
      };
      const request = () =>
        operation === 'search'
          ? service.search('Hello')
          : service.getDetail(123);

      it.each([null, 'text/plain'])(
        'rejects %s before reading the JSON body',
        async (contentType) => {
          const response = Response.json(body);
          if (contentType === null) response.headers.delete('content-type');
          else response.headers.set('content-type', contentType);
          const readBody = jest.spyOn(response, 'json');
          fetchMock.mockResolvedValue(response);
          await expect(request()).rejects.toMatchObject({
            response: { statusCode: 502, code: 'GENIUS_UPSTREAM_ERROR' },
          });
          expect(readBody).not.toHaveBeenCalled();
          expect(fetchMock).toHaveBeenCalledTimes(1);
          expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
        },
      );

      it.each([
        'application/json; charset=utf-8',
        'Application/JSON',
        'application/vnd.genius+json',
      ])('accepts JSON media type %s', async (contentType) => {
        fetchMock.mockResolvedValue(
          Response.json(body, { headers: { 'content-type': contentType } }),
        );
        await expect(request()).resolves.toBeDefined();
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      it('accepts validated Genius JSON mislabeled as text/html', async () => {
        fetchMock.mockResolvedValue(
          Response.json(body, {
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }),
        );
        await expect(request()).resolves.toBeDefined();
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      it.each([
        '<!doctype html><html>Challenge</html>',
        JSON.stringify({ meta: { status: 200 }, response: { unexpected: [] } }),
      ])(
        'rejects actual HTML or invalid Genius schema despite a text/html header %#',
        async (body) => {
          fetchMock.mockResolvedValue(
            new Response(body, {
              headers: { 'content-type': 'text/html; charset=utf-8' },
            }),
          );
          await expect(request()).rejects.toMatchObject({
            response: { statusCode: 502, code: 'GENIUS_UPSTREAM_ERROR' },
          });
          expect(fetchMock).toHaveBeenCalledTimes(1);
        },
      );
    },
  );

  it.each([
    null,
    [],
    {},
    { response: { hits: [] } },
    { meta: { status: 200 }, response: {} },
    { meta: { status: 200 }, response: { hits: {} } },
    { meta: { status: 500 }, response: { hits: [] } },
  ])(
    'rejects malformed envelope %# instead of treating it as no results',
    async (body) => {
      fetchMock.mockResolvedValue(Response.json(body));
      await expectFailure('GENIUS_UPSTREAM_ERROR', 502);
    },
  );

  it('returns no songs for a valid empty result', async () => {
    fetchMock.mockResolvedValue(Response.json(envelope([])));
    await expect(service.search('Hello')).resolves.toEqual([]);
  });

  it('skips non-song and invalid required fields but tolerates missing optional fields', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        envelope([
          null,
          { ...songHit, type: 'artist' },
          { type: 'song' },
          ...[0, -1, 1.5, '123'].map((id) => ({
            type: 'song',
            result: { ...songHit.result, id },
          })),
          { type: 'song', result: { ...songHit.result, title: ' ' } },
          { type: 'song', result: { ...songHit.result, primary_artist: {} } },
          {
            type: 'song',
            result: {
              id: 42,
              title: 'Dreams',
              primary_artist: { name: 'Fleetwood Mac' },
            },
          },
        ]),
      ),
    );
    await expect(service.search('Dreams')).resolves.toEqual([
      {
        id: 42,
        title: 'Dreams',
        primary_artist: { name: 'Fleetwood Mac' },
        primary_artists: [],
        featured_artists: [],
        release_date_components: null,
        song_art_image_url: null,
        song_art_image_thumbnail_url: null,
        header_image_url: null,
        url: null,
      },
    ]);
  });

  it('reads the release year and validates artist lists without dropping a valid song', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        envelope([
          {
            ...songHit,
            result: {
              ...songHit.result,
              release_date_components: { year: 2026, month: 10, day: 21 },
              primary_artists: [
                { id: 1, name: 'K/DA' },
                null,
                { id: 2, name: 'Mimi Webb' },
                { id: 1, name: 'Duplicate' },
                { id: -1, name: 'Invalid' },
                { id: 3, name: ' ' },
              ],
              featured_artists: [
                { id: 4, name: 'Guest' },
                { id: '5', name: 'Invalid' },
              ],
            },
          },
        ]),
      ),
    );
    const [song] = await service.search('WATCH ME');
    expect(song.release_date_components).toEqual({ year: 2026 });
    expect(song.primary_artists).toEqual([
      { id: 1, name: 'K/DA' },
      { id: 2, name: 'Mimi Webb' },
    ]);
    expect(song.featured_artists).toEqual([{ id: 4, name: 'Guest' }]);
  });

  it.each([
    null,
    {},
    { year: null },
    { year: '2026' },
    { year: 0 },
    { year: 10000 },
    { year: 2026.5 },
  ])(
    'does not invent a release year for malformed components %#',
    async (components) => {
      fetchMock.mockResolvedValue(
        Response.json(
          envelope([
            {
              ...songHit,
              result: {
                ...songHit.result,
                release_date_components: components,
              },
            },
          ]),
        ),
      );
      const [song] = await service.search('Hello');
      expect(song.release_date_components).toBeNull();
    },
  );

  it('falls back to the singular primary artist when a valid ID is available', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        envelope([
          {
            ...songHit,
            result: {
              ...songHit.result,
              primary_artist: { id: 10, name: 'Adele' },
              primary_artists: 'invalid',
              featured_artists: {},
            },
          },
        ]),
      ),
    );
    const [song] = await service.search('Hello');
    expect(song.primary_artists).toEqual([{ id: 10, name: 'Adele' }]);
    expect(song.featured_artists).toEqual([]);
  });

  it('treats malformed optional URLs as unavailable', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        envelope([
          {
            type: 'song',
            result: {
              ...songHit.result,
              song_art_image_url: 42,
              song_art_image_thumbnail_url:
                'https://images.genius.com/thumb.jpg',
              url: 'javascript:alert(1)',
            },
          },
        ]),
      ),
    );
    const [song] = await service.search('Hello');
    expect(song.song_art_image_url).toBeNull();
    expect(song.song_art_image_thumbnail_url).toBe(
      'https://images.genius.com/thumb.jpg',
    );
    expect(song.url).toBeNull();
  });

  it('loads detail from the official endpoint and validates album plus ISO release date', async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        meta: { status: 200 },
        response: {
          song: {
            ...songHit.result,
            release_date: '2026-10-21',
            album: {
              id: 77,
              name: 'Fixture album',
              cover_art_url: 'https://images.genius.com/album.jpg',
            },
            primary_artists: [
              { id: 1, name: 'Adele' },
              { id: 2, name: 'Second' },
              { id: 1, name: 'Duplicate' },
              { id: 0, name: 'Invalid' },
            ],
            featured_artists: [{ id: 3, name: 'Guest' }],
          },
        },
      }),
    );
    const result = await service.getDetail(123);
    expect(fetchMock.mock.calls[0][0]).toEqual(
      new URL('https://api.genius.com/songs/123'),
    );
    expect(result).toMatchObject({
      album: {
        id: 77,
        name: 'Fixture album',
        cover_art_url: 'https://images.genius.com/album.jpg',
      },
      release_date_components: { year: 2026 },
      primary_artists: [
        { id: 1, name: 'Adele' },
        { id: 2, name: 'Second' },
      ],
      featured_artists: [{ id: 3, name: 'Guest' }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    null,
    { id: 0, name: 'Bad' },
    { id: 5, name: ' ' },
    { id: '5', name: 'Bad' },
  ])(
    'keeps detail usable with invalid/missing optional album %#',
    async (album) => {
      fetchMock.mockResolvedValue(
        Response.json({
          meta: { status: 200 },
          response: { song: { ...songHit.result, album } },
        }),
      );
      const result = await service.getDetail(123);
      expect(result.album).toBeNull();
      expect(result.release_date_components).toBeNull();
    },
  );

  it.each(['2026-02-30', 'unknown', '2026', '0000-01-01'])(
    'does not invent a year from an invalid detail date %s',
    async (release_date) => {
      fetchMock.mockResolvedValue(
        Response.json({
          meta: { status: 200 },
          response: { song: { ...songHit.result, release_date } },
        }),
      );
      expect((await service.getDetail(123)).release_date_components).toBeNull();
    },
  );

  it.each([
    [404, 404, 'SONG_NOT_FOUND'],
    [401, 503, 'GENIUS_AUTH_FAILED'],
    [403, 503, 'GENIUS_AUTH_FAILED'],
    [429, 503, 'GENIUS_RATE_LIMITED'],
    [500, 502, 'GENIUS_UPSTREAM_ERROR'],
  ])(
    'handles detail upstream HTTP %s',
    async (status, expectedStatus, code) => {
      fetchMock.mockResolvedValue(
        new Response(null, { status: Number(status) }),
      );
      await expect(service.getDetail(123)).rejects.toMatchObject({
        status: expectedStatus,
        response: { code },
      });
    },
  );

  it.each([
    { meta: { status: 200 }, response: {} },
    {
      meta: { status: 200 },
      response: { song: { ...songHit.result, id: 999 } },
    },
    { meta: { status: 200 }, response: { song: { id: 123 } } },
    { response: { song: songHit.result } },
  ])('rejects malformed detail envelope or mismatched ID %#', async (body) => {
    fetchMock.mockResolvedValue(Response.json(body));
    await expect(service.getDetail(123)).rejects.toMatchObject({
      status: 502,
      response: { code: 'GENIUS_UPSTREAM_ERROR' },
    });
  });

  it('aborts a detail response body on timeout', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation((_url, options) =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              options?.signal?.addEventListener('abort', () =>
                controller.error(new DOMException('Aborted', 'AbortError')),
              );
            },
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    const failure = expect(service.getDetail(123)).rejects.toMatchObject({
      status: 504,
      response: { code: 'GENIUS_TIMEOUT' },
    });
    await jest.advanceTimersByTimeAsync(50);
    await failure;
  });

  it('aborts a pending request on timeout', async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    fetchMock.mockImplementation((_url, options) => {
      signal = options?.signal;
      return new Promise((_resolve, reject) =>
        signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        ),
      );
    });
    const failure = expectFailure('GENIUS_TIMEOUT', 504);
    await jest.advanceTimersByTimeAsync(50);
    await failure;
    expect(signal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps timeout active while consuming the response body', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation((_url, options) =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"meta":'));
              options?.signal?.addEventListener('abort', () =>
                controller.error(new DOMException('Aborted', 'AbortError')),
              );
            },
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    const failure = expectFailure('GENIUS_TIMEOUT', 504);
    await jest.advanceTimersByTimeAsync(50);
    await failure;
    expect(jest.getTimerCount()).toBe(0);
  });
});
