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
import { HttpException } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { validateEnvironment } from '../src/config/environment';
import { GeniusService } from '../src/genius/genius.service';
import { LrclibService } from '../src/lrclib/lrclib.service';

const record = {
  id: 123,
  trackName: 'Original Song',
  artistName: 'Original Artist',
  albumName: 'Album',
  duration: 210,
  instrumental: false,
  plainLyrics: '  [Verse: Artist]\nDòng mới\n안녕하세요\nCanción\n',
  syncedLyrics: '[00:01.00] Independent original line\n',
};
const path = (query: Record<string, string>) =>
  '/api/v1/lyrics/search?' + new URLSearchParams(query).toString();

describe('Lyrics search (Fastify e2e, mocked upstream HTTP)', () => {
  let app: NestFastifyApplication;
  let fetchMock: jest.Spied<typeof fetch>;
  let geniusSearch: jest.Spied<GeniusService['search']>;
  let geniusDetail: jest.Spied<GeniusService['getDetail']>;
  beforeEach(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService(
          validateEnvironment({
            GENIUS_ACCESS_TOKEN: '',
            LRCLIB_CLIENT_CONTACT: 'https://example.com/audiomint',
          }),
        ),
      )
      .compile();
    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    geniusSearch = jest.spyOn(app.get(GeniusService), 'search');
    geniusDetail = jest.spyOn(app.get(GeniusService), 'getDetail');
    fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (
        !(input instanceof URL) ||
        input.origin + input.pathname !== 'https://lrclib.net/api/search'
      )
        return Promise.reject(new Error('Unexpected provider request'));
      return Promise.resolve(Response.json([record]));
    });
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  it('trims query fields and returns one complete record without changing either lyric string', async () => {
    const response = await app.inject({
      method: 'GET',
      url: path({
        title: '  Original Song ',
        artist: ' Original Artist  ',
        album: ' Album ',
        duration: ' 210.5 ',
      }),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      query: {
        title: 'Original Song',
        artist: 'Original Artist',
        album: 'Album',
        duration: 210.5,
      },
      lyrics: {
        lrclibId: 123,
        trackName: record.trackName,
        artistName: record.artistName,
        albumName: 'Album',
        duration: 210,
        instrumental: false,
        plainLyrics: record.plainLyrics,
        syncedLyrics: record.syncedLyrics,
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(geniusSearch).not.toHaveBeenCalled();
    expect(geniusDetail).not.toHaveBeenCalled();
    const input = fetchMock.mock.calls[0][0];
    if (!(input instanceof URL)) throw new Error('Expected URL');
    expect([...input.searchParams]).toEqual([
      ['track_name', 'Original Song'],
      ['artist_name', 'Original Artist'],
    ]);
  });

  it('returns explicit nulls for omitted query hints', async () => {
    const response = await app.inject({
      method: 'GET',
      url: path({ title: record.trackName, artist: record.artistName }),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      query: {
        title: record.trackName,
        artist: record.artistName,
        album: null,
        duration: null,
      },
    });
  });

  it.each([
    '',
    '?artist=Artist',
    '?title=Song',
    '?title=&artist=Artist',
    '?title=%20%20&artist=Artist',
    '?title=Song&artist=%20',
    '?title=Song&title=Other&artist=Artist',
    '?title=Song&artist=Artist&artist=Other',
    '?title[x]=Song&artist=Artist',
    '?title=Song&artist=Artist&album=',
    '?title=Song&artist=Artist&album=%20',
    '?title=Song&artist=Artist&album=A&album=B',
    '?title=Song&artist=Artist&duration=',
    '?title=Song&artist=Artist&duration=%20',
    '?title=Song&artist=Artist&duration=NaN',
    '?title=Song&artist=Artist&duration=Infinity',
    '?title=Song&artist=Artist&duration=-1',
    '?title=Song&artist=Artist&duration=0',
    '?title=Song&artist=Artist&duration=1e309',
    '?title=Song&artist=Artist&duration=0x10',
    '?title=Song&artist=Artist&duration=100&duration=101',
    '?title=Song&artist=Artist&limit=1',
    `?title=${'a'.repeat(201)}&artist=Artist`,
    `?title=Song&artist=${'a'.repeat(201)}`,
    `?title=Song&artist=Artist&album=${'a'.repeat(201)}`,
  ])('rejects invalid query %# before external requests', async (query) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/lyrics/search' + query,
    });
    expect(response.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(geniusSearch).not.toHaveBeenCalled();
    expect(geniusDetail).not.toHaveBeenCalled();
  });

  it('accepts finite fractional seconds and maximum metadata length after trimming', async () => {
    const response = await app.inject({
      method: 'GET',
      url: path({
        title: ` ${'a'.repeat(200)} `,
        artist: record.artistName,
        duration: '0.5',
      }),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      query: { title: 'a'.repeat(200), duration: 0.5 },
      lyrics: null,
    });
  });

  it.each([
    {
      plainLyrics: 'Original plain\n',
      syncedLyrics: null,
      instrumental: false,
    },
    {
      plainLyrics: null,
      syncedLyrics: '[00:01.00] Original synced\n',
      instrumental: false,
    },
    { plainLyrics: null, syncedLyrics: null, instrumental: false },
    { plainLyrics: null, syncedLyrics: null, instrumental: true },
  ])(
    'returns partial, empty or instrumental record as provided %#',
    async (fields) => {
      fetchMock.mockResolvedValue(Response.json([{ ...record, ...fields }]));
      const response = await app.inject({
        method: 'GET',
        url: path({ title: record.trackName, artist: record.artistName }),
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        lyrics: { lrclibId: record.id, ...fields },
      });
    },
  );

  it.each([
    { results: [] },
    { results: [{ ...record, artistName: 'Different artist' }] },
    { results: [{ ...record, id: -1 }] },
  ])(
    'returns normal no-match for empty, unsuitable or invalid candidates %#',
    async ({ results }) => {
      fetchMock.mockResolvedValue(Response.json(results));
      const response = await app.inject({
        method: 'GET',
        url: path({ title: record.trackName, artist: record.artistName }),
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        query: {
          title: record.trackName,
          artist: record.artistName,
          album: null,
          duration: null,
        },
        lyrics: null,
      });
    },
  );

  it('automatically selects the best identity and album from multiple records', async () => {
    fetchMock.mockResolvedValue(
      Response.json([
        { ...record, id: 1, trackName: 'Original Song (Live)' },
        { ...record, id: 2, albumName: 'Other album' },
        {
          ...record,
          id: 3,
          plainLyrics: 'Selected original plain\n',
          syncedLyrics: '[00:02] Selected synced\n',
        },
      ]),
    );
    const response = await app.inject({
      method: 'GET',
      url: path({
        title: record.trackName,
        artist: record.artistName,
        album: 'Album',
      }),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      lyrics: {
        lrclibId: 3,
        plainLyrics: 'Selected original plain\n',
        syncedLyrics: '[00:02] Selected synced\n',
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [429, 503, 'LRCLIB_RATE_LIMITED'],
    [500, 502, 'LRCLIB_UPSTREAM_ERROR'],
  ])(
    'serializes upstream HTTP %s as a safe error',
    async (upstream, status, code) => {
      fetchMock.mockResolvedValue(
        new Response('upstream private message', { status: Number(upstream) }),
      );
      const response = await app.inject({
        method: 'GET',
        url: path({ title: record.trackName, artist: record.artistName }),
      });
      expect(response.statusCode).toBe(status);
      expect(response.json()).toEqual({
        statusCode: status,
        code,
        message: expect.any(String),
      });
    },
  );

  it('preserves retry timing in the public error contract', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, { status: 429, headers: { 'retry-after': '30' } }),
    );
    const response = await app.inject({
      method: 'GET',
      url: path({ title: record.trackName, artist: record.artistName }),
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      code: 'LRCLIB_RATE_LIMITED',
      retryAfterSeconds: 30,
    });
  });

  it('returns an upstream schema error instead of no match', async () => {
    fetchMock.mockResolvedValue(Response.json({ items: [] }));
    const response = await app.inject({
      method: 'GET',
      url: path({ title: record.trackName, artist: record.artistName }),
    });
    expect(response.statusCode).toBe(502);
    expect(response.json()).toMatchObject({ code: 'LRCLIB_UPSTREAM_ERROR' });
  });

  it('serializes provider timeout errors', async () => {
    jest.spyOn(app.get(LrclibService), 'search').mockRejectedValue(
      new HttpException(
        {
          statusCode: 504,
          code: 'LRCLIB_TIMEOUT',
          message: 'LRCLIB lyrics search timed out. Please try again.',
        },
        504,
      ),
    );
    const response = await app.inject({
      method: 'GET',
      url: path({ title: record.trackName, artist: record.artistName }),
    });
    expect(response.statusCode).toBe(504);
    expect(response.json()).toMatchObject({ code: 'LRCLIB_TIMEOUT' });
  });

  it('serves health without a Genius token or LRCLIB request', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(response.statusCode).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps Genius Detail independent of LRCLIB', async () => {
    const lyricsSearch = jest.spyOn(app.get(LrclibService), 'search');
    geniusDetail.mockResolvedValue({
      id: 123,
      title: record.trackName,
      primary_artist: { name: record.artistName },
      primary_artists: [],
      featured_artists: [],
      release_date_components: null,
      song_art_image_url: null,
      song_art_image_thumbnail_url: null,
      header_image_url: null,
      url: null,
      album: null,
      media: [],
    });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/songs/123',
    });
    expect(response.statusCode).toBe(200);
    expect(lyricsSearch).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
