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
import type { GeniusSongDetail } from '../src/genius/types/genius-song-detail';

const song: GeniusSongDetail = {
  id: 123,
  title: 'Fixture song',
  primary_artist: { name: 'Artist A' },
  primary_artists: [
    { id: 1, name: 'Artist A' },
    { id: 2, name: 'Artist B' },
  ],
  featured_artists: [{ id: 3, name: 'Guest' }],
  release_date_components: { year: 2026 },
  album: {
    id: 20,
    name: 'Fixture album',
    cover_art_url: 'https://images.genius.com/album.jpg',
  },
  song_art_image_url: 'https://images.genius.com/song.jpg',
  song_art_image_thumbnail_url: null,
  header_image_url: null,
  url: 'https://genius.com/Fixture-song-lyrics',
  media: [
    {
      provider: 'youtube',
      type: 'video',
      start: 0,
      url: 'https://www.youtube.com/watch?v=VOCEZQSO3t4',
    },
  ],
};

describe('Song detail (Fastify e2e)', () => {
  let app: NestFastifyApplication;
  let detail: jest.Spied<GeniusService['getDetail']>;
  let fetchMock: jest.Spied<typeof fetch>;

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
    detail = jest
      .spyOn(app.get(GeniusService), 'getDetail')
      .mockResolvedValue(song);
    fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Unexpected extra HTTP request'));
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  it('returns API metadata, album, YouTube media and page URL without extra HTTP requests', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/songs/123',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      geniusId: 123,
      title: 'Fixture song',
      artistName: 'Artist A',
      primaryArtists: [
        { geniusId: 1, name: 'Artist A' },
        { geniusId: 2, name: 'Artist B' },
      ],
      featuredArtists: [{ geniusId: 3, name: 'Guest' }],
      year: 2026,
      album: { geniusId: 20, title: 'Fixture album' },
      coverUrl: song.album?.cover_art_url,
      geniusUrl: song.url,
      media: song.media,
    });
    expect(detail).toHaveBeenCalledWith(123);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps missing optional metadata to null while retaining song artwork', async () => {
    detail.mockResolvedValue({
      ...song,
      album: null,
      release_date_components: null,
    });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/songs/123',
    });
    expect(response.json()).toMatchObject({
      album: null,
      year: null,
      coverUrl: song.song_art_image_url,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to null artwork without valid album or song images', async () => {
    detail.mockResolvedValue({
      ...song,
      album: null,
      song_art_image_url: null,
      url: null,
    });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/songs/123',
    });
    expect(response.json()).toMatchObject({ coverUrl: null, geniusUrl: null });
  });

  it.each(['0', '-1', '1.2', '123abc', '9007199254740992', '%2B1', '%201'])(
    'rejects invalid ID %s before upstream calls',
    async (id) => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/songs/' + id,
      });
      expect(response.statusCode).toBe(400);
      expect(detail).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each(['1', '000123', '9007199254740991'])(
    'accepts safe digit ID %s',
    async (id) => {
      detail.mockResolvedValue({ ...song, id: Number(id) });
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/songs/' + id,
      });
      expect(response.statusCode).toBe(200);
      expect(detail).toHaveBeenCalledWith(Number(id));
    },
  );

  it('retains the static search route', async () => {
    const search = jest
      .spyOn(app.get(GeniusService), 'search')
      .mockResolvedValue([]);
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/songs/search?q=fixture',
    });
    expect(response.statusCode).toBe(200);
    expect(search).toHaveBeenCalledWith('fixture');
    expect(detail).not.toHaveBeenCalled();
  });

  it('propagates a missing song', async () => {
    detail.mockRejectedValue(
      new HttpException(
        {
          statusCode: 404,
          code: 'SONG_NOT_FOUND',
          message: 'Song was not found.',
        },
        404,
      ),
    );
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/songs/123',
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: 'SONG_NOT_FOUND' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not expose the removed lyrics endpoint', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/songs/123/lyrics',
    });
    expect(response.statusCode).toBe(404);
    expect(detail).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
