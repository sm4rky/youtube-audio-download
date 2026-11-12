import { describe, expect, it } from '@jest/globals';
import { parseGeniusArtistSongsResponse } from './genius-artist-songs.parser';
import { parseGeniusAlbumTracksResponse } from './genius-album-tracks.parser';

const song = {
  id: 123,
  title: 'Đừng hỏi em / 사랑 / Canción',
  primary_artist: { id: 10, name: 'Nghệ sĩ' },
  primary_artists: [
    { id: 10, name: 'Nghệ sĩ' },
    { id: 11, name: '가수' },
  ],
  featured_artists: [{ id: 12, name: 'Invitado' }],
  release_date_components: { year: 2026 },
  song_art_image_url: 'https://images.genius.com/cover.jpg',
  url: 'https://genius.com/example-lyrics',
};

describe.each([
  { collection: 'songs', parse: parseGeniusArtistSongsResponse },
  { collection: 'tracks', parse: parseGeniusAlbumTracksResponse },
])('$collection envelope and pagination', ({ collection, parse }) => {
  it('accepts an empty final page', () => {
    expect(
      parse(
        {
          meta: { status: 200 },
          response: { [collection]: [], next_page: null },
        },
        99,
      ),
    ).toEqual({ [collection]: [], next_page: null });
  });

  it.each([undefined, 0, -1, 1.5, '2', 1, 9007199254740992])(
    'rejects invalid/non-forward next_page %s',
    (next_page) => {
      expect(
        parse(
          { meta: { status: 200 }, response: { [collection]: [], next_page } },
          1,
        ),
      ).toBeNull();
    },
  );

  it.each([
    null,
    [],
    {},
    { meta: { status: 500 }, response: {} },
    { meta: { status: 200 }, response: { next_page: null } },
  ])('rejects malformed envelopes %#', (value) => {
    expect(parse(value, 1)).toBeNull();
  });
});

describe('Artist songs parser', () => {
  it('preserves order, Unicode, artist arrays and optional metadata while skipping invalid/duplicate songs', () => {
    const result = parseGeniusArtistSongsResponse(
      {
        meta: { status: 200 },
        response: {
          songs: [
            null,
            { ...song, id: -1 },
            song,
            { ...song, title: 'Duplicate' },
            {
              id: 456,
              title: 'Other',
              primary_artist: { id: 13, name: 'Other artist' },
            },
          ],
          next_page: 2,
        },
      },
      1,
    );
    expect(result?.songs.map((entry) => entry.id)).toEqual([123, 456]);
    expect(result?.songs[0]).toMatchObject({
      title: song.title,
      primary_artist: { name: song.primary_artist.name },
      primary_artists: song.primary_artists,
      featured_artists: song.featured_artists,
      release_date_components: song.release_date_components,
      song_art_image_url: song.song_art_image_url,
      url: song.url,
    });
    expect(result?.songs[1]).toMatchObject({
      primary_artists: [{ id: 13, name: 'Other artist' }],
      featured_artists: [],
      release_date_components: null,
      song_art_image_url: null,
      url: null,
    });
    expect(result?.next_page).toBe(2);
  });
});

describe('Album tracks parser', () => {
  it('preserves album positions and repeated songs across discs using disc-relative numbering', () => {
    const result = parseGeniusAlbumTracksResponse(
      {
        meta: { status: 200 },
        response: {
          tracks: [
            { song, number: 9, disc_track_number: 9, disc_number: 1 },
            { song, number: 10, disc_track_number: 1, disc_number: 2 },
            { song, number: 11 },
            { song, disc_track_number: -1, disc_number: '1' },
            { song: { ...song, title: '' } },
            null,
          ],
          next_page: 3,
        },
      },
      2,
    );
    expect(
      result?.tracks.map(({ disc_track_number, disc_number }) => [
        disc_track_number,
        disc_number,
      ]),
    ).toEqual([
      [9, 1],
      [1, 2],
      [null, null],
      [null, null],
    ]);
    expect(result?.tracks.map((track) => track.song.id)).toEqual([
      123, 123, 123, 123,
    ]);
    expect(result?.next_page).toBe(3);
  });
});
