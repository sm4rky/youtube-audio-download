import { describe, expect, it } from '@jest/globals';
import type { LrclibRecord } from '../../lrclib/types/lrclib-record';
import type { LyricsSearchCriteria } from '../types/lyrics-search-response';
import { selectBestLyricsMatch } from './lyrics.matcher';

const query: LyricsSearchCriteria = {
  title: 'Original Song',
  artist: 'Original Artist',
  album: null,
  duration: null,
};
const record: LrclibRecord = {
  id: 1,
  trackName: query.title,
  artistName: query.artist,
  albumName: 'Album',
  duration: 210,
  instrumental: false,
  plainLyrics: 'Original text',
  syncedLyrics: null,
};

describe('automatic lyrics selection priorities', () => {
  it('returns null without candidates', () => {
    expect(selectBestLyricsMatch([], query)).toBeNull();
  });

  it('selects a single identity match', () => {
    expect(selectBestLyricsMatch([record], query)).toBe(record);
  });

  it('compares NFC, case and whitespace while retaining original fields', () => {
    const candidate = {
      ...record,
      trackName: '  TÊN   BÀI HÁT '.normalize('NFD'),
      artistName: ' NGHỆ SĨ ',
    };
    expect(
      selectBestLyricsMatch([candidate], {
        ...query,
        title: 'Tên bài hát',
        artist: 'Nghệ sĩ',
      }),
    ).toBe(candidate);
    expect(candidate.trackName).toBe('  TÊN   BÀI HÁT '.normalize('NFD'));
  });

  it.each(['안녕하세요', '東京の歌', 'Canción del corazón', 'Đừng hỏi em'])(
    'matches Unicode title %s without ASCII conversion',
    (title) => {
      const candidate = { ...record, trackName: title };
      expect(selectBestLyricsMatch([candidate], { ...query, title })).toBe(
        candidate,
      );
    },
  );

  it('prefers exact album before duration or lyric availability', () => {
    const wrongAlbum = {
      ...record,
      duration: 200,
      syncedLyrics: '[00:01] Synced',
    };
    const correctAlbum = {
      ...record,
      id: 2,
      albumName: 'Wanted album',
      duration: 250,
    };
    expect(
      selectBestLyricsMatch([wrongAlbum, correctAlbum], {
        ...query,
        album: 'WANTED ALBUM',
        duration: 200,
      }),
    ).toBe(correctAlbum);
  });

  it('uses album as a soft signal when no candidate matches it', () => {
    expect(
      selectBestLyricsMatch([record], { ...query, album: 'Unknown album' }),
    ).toBe(record);
  });

  it('prefers closer duration before having both lyric fields', () => {
    const bothLyrics = {
      ...record,
      syncedLyrics: '[00:01] Synced',
      duration: 230,
    };
    const closer = { ...record, id: 2, duration: 201 };
    expect(
      selectBestLyricsMatch([bothLyrics, closer], { ...query, duration: 200 }),
    ).toBe(closer);
  });

  it('does not reject a matching recording when YouTube duration is much longer', () => {
    expect(selectBestLyricsMatch([record], { ...query, duration: 900 })).toBe(
      record,
    );
  });

  it('prefers a known duration over a missing one when duration is supplied', () => {
    expect(
      selectBestLyricsMatch(
        [
          { ...record, duration: null },
          { ...record, id: 2 },
        ],
        { ...query, duration: 210 },
      )?.id,
    ).toBe(2);
  });

  it('prefers both lyrics only after matching metadata ties', () => {
    const both = {
      ...record,
      id: 2,
      syncedLyrics: '[00:01] Different source text',
    };
    expect(selectBestLyricsMatch([record, both], query)).toBe(both);
  });

  it('preserves upstream order for ties without choosing by ID', () => {
    const first = { ...record, id: 20 };
    expect(selectBestLyricsMatch([first, record], query)).toBe(first);
  });

  it.each(['Live', 'Remix', 'Cover', 'Acoustic', 'Instrumental', 'Remastered'])(
    'preserves version marker %s',
    (version) => {
      const differentVersion = {
        ...record,
        trackName: `${query.title} (${version})`,
        syncedLyrics: '[00:01] Synced',
      };
      expect(selectBestLyricsMatch([differentVersion], query)).toBeNull();
      expect(
        selectBestLyricsMatch([record, differentVersion], {
          ...query,
          title: differentVersion.trackName,
        }),
      ).toBe(differentVersion);
    },
  );

  it('does not select a wrong artist or title even with matching album/duration and both lyrics', () => {
    const differentArtist = {
      ...record,
      artistName: 'Other artist',
      syncedLyrics: '[00:01] Synced',
    };
    const differentTitle = {
      ...record,
      trackName: 'Other song',
      syncedLyrics: '[00:01] Synced',
    };
    expect(
      selectBestLyricsMatch([differentArtist, differentTitle], {
        ...query,
        album: 'Album',
        duration: 210,
      }),
    ).toBeNull();
  });

  it('keeps accent distinctions', () => {
    expect(
      selectBestLyricsMatch([{ ...record, trackName: 'Cancion' }], {
        ...query,
        title: 'Canción',
      }),
    ).toBeNull();
  });
});
