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
import { GeniusService } from '../src/genius/genius.service';
import type { GeniusSong } from '../src/genius/types/genius-song';

const song: GeniusSong = {
  id: 123,
  title: 'Hello',
  primary_artist: { name: 'Adele' },
  primary_artists: [
    { id: 10, name: 'Adele' },
    { id: 11, name: 'Second artist' },
  ],
  featured_artists: [{ id: 12, name: 'Guest artist' }],
  release_date_components: { year: 2015 },
  song_art_image_url: 'https://images.genius.com/cover.jpg',
  song_art_image_thumbnail_url: 'https://images.genius.com/thumbnail.jpg',
  header_image_url: 'https://images.genius.com/header.jpg',
  url: 'https://genius.com/Adele-hello-lyrics',
};

describe('Songs search (Fastify e2e)', () => {
  let app: NestFastifyApplication;
  let search: jest.Spied<GeniusService['search']>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService(validateEnvironment({ GENIUS_ACCESS_TOKEN: '' })),
      )
      .compile();
    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    search = jest
      .spyOn(app.get(GeniusService), 'search')
      .mockResolvedValue([song]);
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  it('trims input and returns only the project search contract', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/songs/search?${new URLSearchParams({ q: '  Adele Hello  ' })}`,
    });
    expect(response.statusCode).toBe(200);
    expect(search).toHaveBeenCalledWith('Adele Hello');
    expect(response.json()).toEqual({
      query: 'Adele Hello',
      items: [
        {
          geniusId: 123,
          title: 'Hello',
          artistName: 'Adele',
          year: 2015,
          primaryArtists: [
            { geniusId: 10, name: 'Adele' },
            { geniusId: 11, name: 'Second artist' },
          ],
          featuredArtists: [{ geniusId: 12, name: 'Guest artist' }],
          coverUrl: song.song_art_image_url,
          geniusUrl: song.url,
        },
      ],
    });
  });

  it('preserves Unicode, live/remix/cover and special query characters', async () => {
    const query = 'Đừng hỏi em – live remix cover & + #?';
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/songs/search?${new URLSearchParams({ q: ` ${query} ` })}`,
    });
    expect(response.statusCode).toBe(200);
    expect(search).toHaveBeenCalledWith(query);
    expect(response.json<{ query: string }>().query).toBe(query);
  });

  it.each([
    '',
    '?q=',
    '?q=%20%20',
    '?q=a&q=b',
    '?q[x]=a',
    `?q=${'a'.repeat(201)}`,
    '?q=Hello&limit=1',
  ])('rejects invalid query %s before calling Genius', async (suffix) => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/songs/search${suffix}`,
    });
    expect(response.statusCode).toBe(400);
    expect(search).not.toHaveBeenCalled();
  });

  it('accepts the maximum query length after trimming', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/songs/search?${new URLSearchParams({ q: ` ${'a'.repeat(200)} ` })}`,
    });
    expect(response.statusCode).toBe(200);
    expect(search).toHaveBeenCalledWith('a'.repeat(200));
  });

  it('deduplicates by ID, retains the first occurrence and upstream order', async () => {
    search.mockResolvedValue([
      song,
      { ...song, title: 'Duplicate' },
      { ...song, id: 321, title: 'Second' },
    ]);
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/songs/search?q=Hello',
    });
    expect(
      response
        .json<{ items: { geniusId: number; title: string }[] }>()
        .items.map((item) => [item.geniusId, item.title]),
    ).toEqual([
      [123, 'Hello'],
      [321, 'Second'],
    ]);
  });

  it('falls back from song artwork to thumbnail then header and finally null', async () => {
    search.mockResolvedValue([
      { ...song, song_art_image_url: null },
      {
        ...song,
        id: 2,
        song_art_image_url: null,
        song_art_image_thumbnail_url: null,
      },
      {
        ...song,
        id: 3,
        song_art_image_url: null,
        song_art_image_thumbnail_url: null,
        header_image_url: null,
        url: null,
      },
    ]);
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/songs/search?q=Hello',
    });
    const { items } = response.json<{
      items: { coverUrl: string | null; geniusUrl: string | null }[];
    }>();
    expect(items.map((item) => item.coverUrl)).toEqual([
      song.song_art_image_thumbnail_url,
      song.header_image_url,
      null,
    ]);
    expect(items[2].geniusUrl).toBeNull();
  });

  it('returns a successful empty result', async () => {
    search.mockResolvedValue([]);
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/songs/search?q=unknown',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ query: 'unknown', items: [] });
  });

  it('returns null year and empty artist lists when upstream metadata is unavailable', async () => {
    search.mockResolvedValue([
      {
        ...song,
        release_date_components: null,
        primary_artists: [],
        featured_artists: [],
      },
    ]);
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/songs/search?q=Hello',
    });
    expect(
      response.json<{ items: Record<string, unknown>[] }>().items[0],
    ).toMatchObject({
      year: null,
      primaryArtists: [],
      featuredArtists: [],
      artistName: 'Adele',
    });
  });
});
