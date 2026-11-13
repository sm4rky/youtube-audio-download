import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { GeniusService } from './genius.service';

describe.each(['artist', 'album'] as const)(
  'Genius %s discovery HTTP boundary',
  (resource) => {
    let service: GeniusService;
    let fetchMock: jest.Spied<typeof fetch>;
    const request = () =>
      resource === 'artist'
        ? service.getArtistSongs(2358, 2, 5, 'title')
        : service.getAlbumTracks(1776887, 2, 5);
    const envelope = {
      meta: { status: 200 },
      response: { songs: [], tracks: [], next_page: null },
    };

    beforeEach(() => {
      service = new GeniusService(
        new ConfigService({
          GENIUS_ACCESS_TOKEN: 'test-only',
          GENIUS_TIMEOUT_MS: 50,
        }),
      );
      fetchMock = jest.spyOn(globalThis, 'fetch');
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    });
    afterEach(() => {
      jest.restoreAllMocks();
      jest.useRealTimers();
    });

    it('fetches exactly one fixed Developer API page with authentication and no extra detail/lyrics calls', async () => {
      fetchMock.mockResolvedValue(Response.json(envelope));
      await request();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBeInstanceOf(URL);
      if (!(url instanceof URL)) throw new Error('Expected URL');
      expect(url.origin).toBe('https://api.genius.com');
      expect(url.pathname).toBe(
        resource === 'artist'
          ? '/artists/2358/songs'
          : '/albums/1776887/tracks',
      );
      expect(Object.fromEntries(url.searchParams)).toEqual({
        page: '2',
        per_page: '5',
        ...(resource === 'artist' ? { sort: 'title' } : {}),
      });
      expect(options?.headers).toEqual({
        Authorization: 'Bearer test-only',
        Accept: 'application/json',
      });
      expect(options?.redirect).toBe('error');
    });

    it('rejects missing token before fetch', async () => {
      service = new GeniusService(
        new ConfigService({ GENIUS_ACCESS_TOKEN: '' }),
      );
      await expect(request()).rejects.toMatchObject({
        response: { statusCode: 503, code: 'GENIUS_NOT_CONFIGURED' },
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
      [404, 404, 'NOT_FOUND'],
      [401, 503, 'GENIUS_AUTH_FAILED'],
      [403, 503, 'GENIUS_AUTH_FAILED'],
      [429, 503, 'GENIUS_RATE_LIMITED'],
      [500, 502, 'GENIUS_UPSTREAM_ERROR'],
      [422, 502, 'GENIUS_UPSTREAM_ERROR'],
    ])('maps HTTP %s without retry', async (status, statusCode, code) => {
      fetchMock.mockResolvedValue(new Response('', { status }));
      await expect(request()).rejects.toMatchObject({
        response: {
          statusCode,
          code:
            code === 'NOT_FOUND' ? `${resource.toUpperCase()}_NOT_FOUND` : code,
        },
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    });

    it.each(['network', 'json', 'schema', 'html'])(
      'maps %s failure to 502',
      async (failure) => {
        if (failure === 'network')
          fetchMock.mockRejectedValue(new Error('Network failed'));
        else
          fetchMock.mockResolvedValue(
            failure === 'schema'
              ? Response.json({})
              : new Response(
                  failure === 'html' ? '<html>Challenge</html>' : '{',
                  {
                    headers: {
                      'content-type':
                        failure === 'html' ? 'text/html' : 'application/json',
                    },
                  },
                ),
          );
        await expect(request()).rejects.toMatchObject({
          response: { statusCode: 502, code: 'GENIUS_UPSTREAM_ERROR' },
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
      },
    );

    it('rejects an HTML content type before reading a JSON-shaped body', async () => {
      const response = Response.json(envelope, {
        headers: { 'content-type': 'text/html' },
      });
      const readBody = jest.spyOn(response, 'json');
      fetchMock.mockResolvedValue(response);
      await expect(request()).rejects.toMatchObject({
        response: { statusCode: 502, code: 'GENIUS_UPSTREAM_ERROR' },
      });
      expect(readBody).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('aborts a stalled request at the timeout', async () => {
      jest.useFakeTimers();
      fetchMock.mockImplementation(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener(
              'abort',
              () => reject(new Error('Aborted')),
              { once: true },
            );
          }),
      );
      const result = expect(request()).rejects.toMatchObject({
        response: { statusCode: 504, code: 'GENIUS_TIMEOUT' },
      });
      await jest.advanceTimersByTimeAsync(51);
      await result;
      expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    });

    it('keeps cancellation active during body consumption', async () => {
      jest.useFakeTimers();
      fetchMock.mockImplementation((_url, options) =>
        Promise.resolve(
          new Response(
            new ReadableStream({
              start(controller) {
                options?.signal?.addEventListener(
                  'abort',
                  () => controller.error(new Error('Aborted body')),
                  { once: true },
                );
              },
            }),
            { headers: { 'content-type': 'application/json' } },
          ),
        ),
      );
      const result = expect(request()).rejects.toMatchObject({
        response: { statusCode: 504, code: 'GENIUS_TIMEOUT' },
      });
      await jest.advanceTimersByTimeAsync(51);
      await result;
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  },
);
