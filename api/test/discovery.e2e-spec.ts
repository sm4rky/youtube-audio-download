import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { validateEnvironment } from '../src/config/environment';

const song = {
  id: 14141792,
  title: 'WATCH ME',
  primary_artist: { id: 1626547, name: 'K/DA' },
  primary_artists: [
    { id: 1626547, name: 'K/DA' },
    { id: 152927, name: 'League of Legends' },
  ],
  featured_artists: [{ id: 10, name: 'Guest' }],
};
const summary = {
  geniusId: 14141792,
  title: 'WATCH ME',
  artistName: 'K/DA',
  year: null,
  primaryArtists: [
    { geniusId: 1626547, name: 'K/DA' },
    { geniusId: 152927, name: 'League of Legends' },
  ],
  featuredArtists: [{ geniusId: 10, name: 'Guest' }],
  coverUrl: null,
  geniusUrl: null,
};

describe.each(['artist', 'album'] as const)(
  '%s discovery (Fastify e2e)',
  (resource) => {
    let app: NestFastifyApplication;
    let fetchMock: jest.Spied<typeof fetch>;
    const route =
      resource === 'artist'
        ? '/api/v1/artists/2358/songs'
        : '/api/v1/albums/1776887/tracks';
    const collection = resource === 'artist' ? 'songs' : 'tracks';
    const entry =
      resource === 'artist'
        ? song
        : { number: 12, disc_track_number: 2, disc_number: 2, song };

    beforeEach(async () => {
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(ConfigService)
        .useValue(
          new ConfigService(
            validateEnvironment({ GENIUS_ACCESS_TOKEN: 'test-only' }),
          ),
        )
        .compile();
      app = module.createNestApplication<NestFastifyApplication>(
        new FastifyAdapter(),
      );
      configureApp(app);
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        Response.json({
          meta: { status: 200 },
          response: { [collection]: [entry], next_page: 2 },
        }),
      );
    });
    afterEach(async () => {
      jest.restoreAllMocks();
      await app?.close();
    });

    it('returns the public contract with defaults and exactly one upstream request', async () => {
      const response = await app.inject({ method: 'GET', url: route });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        ...(resource === 'artist'
          ? { artistId: 2358, sort: 'popularity' }
          : { albumId: 1776887 }),
        pagination: { page: 1, perPage: 20, nextPage: 2, hasMore: true },
        items:
          resource === 'artist'
            ? [summary]
            : [{ trackNumber: 2, discNumber: 2, song: summary }],
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url] = fetchMock.mock.calls[0];
      if (!(url instanceof URL)) throw new Error('Expected URL');
      expect(url.origin).toBe('https://api.genius.com');
      expect(url.searchParams.get('page')).toBe('1');
      expect(url.searchParams.get('per_page')).toBe('20');
      if (resource === 'artist')
        expect(url.searchParams.get('sort')).toBe('popularity');
    });

    it('maps an explicit last page and missing track numbers without inventing metadata', async () => {
      fetchMock.mockResolvedValue(
        Response.json({
          meta: { status: 200 },
          response: {
            [collection]:
              resource === 'artist' ? [song] : [{ song, number: 12 }],
            next_page: null,
          },
        }),
      );
      const response = await app.inject({
        method: 'GET',
        url:
          route +
          '?page=2&perPage=50' +
          (resource === 'artist' ? '&sort=title' : ''),
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        pagination: { page: 2, perPage: 50, nextPage: null, hasMore: false },
      });
      if (resource === 'album')
        expect(response.json()).toMatchObject({
          items: [{ trackNumber: null, discNumber: null }],
        });
      else expect(response.json()).toMatchObject({ sort: 'title' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('returns a valid empty page as HTTP 200', async () => {
      fetchMock.mockResolvedValue(
        Response.json({
          meta: { status: 200 },
          response: { [collection]: [], next_page: null },
        }),
      );
      const response = await app.inject({
        method: 'GET',
        url: route + '?page=100',
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        pagination: { page: 100, nextPage: null, hasMore: false },
        items: [],
      });
    });

    it('keeps upstream pagination after skipping invalid entries and preserves repeated album positions', async () => {
      fetchMock.mockResolvedValue(
        Response.json({
          meta: { status: 200 },
          response: { [collection]: [null, entry, entry], next_page: 7 },
        }),
      );
      const response = await app.inject({ method: 'GET', url: route });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        pagination: { nextPage: 7, hasMore: true },
      });
      expect(response.json<{ items: unknown[] }>().items).toHaveLength(
        resource === 'artist' ? 1 : 2,
      );
    });

    it.each([
      'page=0',
      'page=-1',
      'page=1.5',
      'page=9007199254740992',
      'page=NaN',
      'page=Infinity',
      'page=1e2',
      'page=',
      'page=1&page=2',
      'page[x]=1',
      'perPage=51',
      'perPage=0',
      'perPage=1.5',
      'perPage=1&perPage=2',
      'extra=1',
      'sort=release_date',
      'sort=unknown',
      'sort=title&sort=popularity',
    ])('rejects invalid query %s before external requests', async (query) => {
      const response = await app.inject({
        method: 'GET',
        url: route + '?' + query,
      });
      expect(response.statusCode).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each(['0', '-1', '1.5', 'abc', '%2B1', '9007199254740992'])(
      'rejects invalid ID %s',
      async (id) => {
        const response = await app.inject({
          method: 'GET',
          url: route.replace(resource === 'artist' ? '2358' : '1776887', id),
        });
        expect(response.statusCode).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
      },
    );

    it.each([
      [404, 404, 'NOT_FOUND'],
      [403, 503, 'GENIUS_AUTH_FAILED'],
      [429, 503, 'GENIUS_RATE_LIMITED'],
      [500, 502, 'GENIUS_UPSTREAM_ERROR'],
    ])(
      'maps upstream status %s using the existing error contract',
      async (upstream, statusCode, code) => {
        fetchMock.mockResolvedValue(new Response('', { status: upstream }));
        const response = await app.inject({ method: 'GET', url: route });
        expect(response.statusCode).toBe(statusCode);
        expect(response.json()).toMatchObject({
          statusCode,
          code:
            code === 'NOT_FOUND' ? `${resource.toUpperCase()}_NOT_FOUND` : code,
          message: expect.any(String),
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
      },
    );

    it('does not convert malformed pagination into an empty success', async () => {
      fetchMock.mockResolvedValue(
        Response.json({
          meta: { status: 200 },
          response: { [collection]: [], next_page: '2' },
        }),
      );
      const response = await app.inject({ method: 'GET', url: route });
      expect(response.statusCode).toBe(502);
      expect(response.json()).toMatchObject({ code: 'GENIUS_UPSTREAM_ERROR' });
    });
  },
);
