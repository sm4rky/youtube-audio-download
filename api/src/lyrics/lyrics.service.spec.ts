import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { LrclibService } from '../lrclib/lrclib.service';
import type { LrclibRecord } from '../lrclib/types/lrclib-record';
import type { LyricsSearchCriteria } from './types/lyrics-search-response';
import { LyricsService } from './lyrics.service';

const query: LyricsSearchCriteria = {
  title: 'Original Song',
  artist: 'Original Artist',
  album: 'Album',
  duration: 210,
};
const record: LrclibRecord = {
  id: 1,
  trackName: query.title,
  artistName: query.artist,
  albumName: 'Album',
  duration: 210,
  instrumental: false,
  plainLyrics: '  [Verse]\nOriginal text\n',
  syncedLyrics: null,
};

describe('LyricsService orchestration', () => {
  let service: LyricsService;
  let search: jest.Spied<LrclibService['search']>;
  beforeEach(() => {
    const lrclib = new LrclibService(new ConfigService());
    search = jest.spyOn(lrclib, 'search').mockResolvedValue([record]);
    service = new LyricsService(lrclib);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('performs one search and maps the chosen original record', async () => {
    await expect(service.search(query)).resolves.toEqual({
      query,
      lyrics: {
        lrclibId: 1,
        trackName: record.trackName,
        artistName: record.artistName,
        albumName: record.albumName,
        duration: 210,
        instrumental: false,
        plainLyrics: record.plainLyrics,
        syncedLyrics: null,
      },
    });
    expect(search).toHaveBeenCalledWith(query.title, query.artist);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('never combines plain and synced lyrics from different records', async () => {
    search.mockResolvedValue([
      record,
      {
        ...record,
        id: 2,
        plainLyrics: null,
        syncedLyrics: '[00:01.00] Other record',
      },
    ]);
    await expect(service.search(query)).resolves.toMatchObject({
      lyrics: {
        lrclibId: 1,
        plainLyrics: record.plainLyrics,
        syncedLyrics: null,
      },
    });
  });

  it('returns both original fields from a selected complete record', async () => {
    const complete = {
      ...record,
      id: 2,
      plainLyrics: 'Different original plain\n',
      syncedLyrics: '[00:01] Independent synced text\n',
    };
    search.mockResolvedValue([record, complete]);
    await expect(service.search(query)).resolves.toMatchObject({
      lyrics: {
        lrclibId: 2,
        plainLyrics: complete.plainLyrics,
        syncedLyrics: complete.syncedLyrics,
      },
    });
  });

  it.each([
    { candidates: [] },
    { candidates: [{ ...record, artistName: 'Wrong artist' }] },
  ])(
    'returns null for empty or unsuitable results %#',
    async ({ candidates }) => {
      search.mockResolvedValue(candidates);
      await expect(service.search(query)).resolves.toEqual({
        query,
        lyrics: null,
      });
    },
  );

  it('propagates provider errors rather than converting them to no match', async () => {
    const error = new HttpException(
      { statusCode: 504, code: 'LRCLIB_TIMEOUT', message: 'Timeout' },
      504,
    );
    search.mockRejectedValue(error);
    await expect(service.search(query)).rejects.toBe(error);
  });

  it('returns a matching instrumental record without manufacturing lyrics', async () => {
    search.mockResolvedValue([
      { ...record, instrumental: true, plainLyrics: null, syncedLyrics: null },
    ]);
    await expect(service.search(query)).resolves.toMatchObject({
      lyrics: { instrumental: true, plainLyrics: null, syncedLyrics: null },
    });
  });
});
