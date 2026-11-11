import { describe, expect, it } from '@jest/globals';
import { parseGeniusSearchResponse } from './genius-search.parser';
import { parseGeniusDetailResponse } from './genius-detail.parser';

describe('independent Genius endpoint contracts', () => {
  const song = {
    id: 123,
    title: 'Original fixture',
    primary_artist: { id: 1, name: 'Artist' },
    release_date: '2026-10-21',
    album: { id: 2, name: 'Album' },
  };

  it('applies detail-only date fallback and album parsing without changing search', () => {
    const search = parseGeniusSearchResponse({
      meta: { status: 200 },
      response: { hits: [{ type: 'song', result: song }] },
    });
    const detail = parseGeniusDetailResponse(
      { meta: { status: 200 }, response: { song } },
      123,
    );
    expect(search).toEqual([
      expect.objectContaining({ release_date_components: null }),
    ]);
    expect(search?.[0]).not.toHaveProperty('album');
    expect(detail).toMatchObject({
      release_date_components: { year: 2026 },
      album: { id: 2, name: 'Album', cover_art_url: null },
    });
  });

  it('distinguishes invalid endpoint envelopes from a valid empty search result', () => {
    const emptySearch = { meta: { status: 200 }, response: { hits: [] } };
    const detail = { meta: { status: 200 }, response: { song } };
    expect(parseGeniusSearchResponse(emptySearch)).toEqual([]);
    expect(parseGeniusDetailResponse(emptySearch, 123)).toBeNull();
    expect(parseGeniusSearchResponse(detail)).toBeNull();
    expect(parseGeniusDetailResponse(detail, 999)).toBeNull();
  });

  it('retains only validated YouTube media, in source order, with safe defaults and no duplicate URLs', () => {
    const media = [
      {
        provider: 'youtube',
        type: 'video',
        start: 0,
        url: 'https://www.youtube.com/watch?v=VOCEZQSO3t4',
      },
      { provider: 'spotify', url: 'https://open.spotify.com/track/example' },
      { provider: 'youtube', url: 'https://evil.example/video' },
      { provider: 'youtube', url: 'https://user:secret@youtube.com/video' },
      { provider: 'youtube', url: 'http://youtube.com/video' },
      { provider: 'youtube', url: 'https://youtube.com:444/video' },
      {
        provider: 'youtube',
        type: 'video',
        start: 1,
        url: 'https://www.youtube.com/watch?v=VOCEZQSO3t4',
      },
      { provider: 'youtube', start: -1, url: 'https://youtu.be/VOCEZQSO3t4' },
    ];
    const detail = parseGeniusDetailResponse(
      { meta: { status: 200 }, response: { song: { ...song, media } } },
      123,
    );
    expect(detail?.media).toEqual([
      media[0],
      {
        provider: 'youtube',
        type: null,
        start: null,
        url: 'https://youtu.be/VOCEZQSO3t4',
      },
    ]);
  });
});
