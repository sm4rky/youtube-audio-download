import { describe, expect, it } from '@jest/globals';
import { parseLrclibSearchResponse } from './lrclib-search.parser';

const record = {
  id: 123,
  trackName: 'Original Song',
  artistName: 'Original Artist',
  albumName: 'Album',
  duration: 210.5,
  instrumental: false,
  plainLyrics: '[Verse: Artist]\nOriginal line\n',
  syncedLyrics: '[00:12.50] Original line\n',
};

describe('LRCLIB search response parser', () => {
  it('validates records and ignores unused additional fields', () => {
    expect(
      parseLrclibSearchResponse([
        {
          ...record,
          name: record.trackName,
          lyricsfile: 'ignored',
          hasWordSync: true,
        },
      ]),
    ).toEqual([record]);
  });

  it('accepts a valid empty search', () => {
    expect(parseLrclibSearchResponse([])).toEqual([]);
  });

  it.each([null, {}, { items: [] }, 'invalid'])(
    'rejects invalid envelope %#',
    (value) => {
      expect(parseLrclibSearchResponse(value)).toBeNull();
    },
  );

  it.each([
    { id: 0 },
    { id: -1 },
    { id: 1.5 },
    { id: Number.MAX_SAFE_INTEGER + 1 },
    { id: '123' },
    { trackName: '' },
    { artistName: ' ' },
    { instrumental: 'false' },
    { instrumental: undefined },
    { duration: NaN },
    { duration: Infinity },
    { duration: -1 },
    { duration: 0 },
    { duration: '210' },
    { plainLyrics: undefined },
    { plainLyrics: 12 },
    { syncedLyrics: false },
    { albumName: 123 },
  ])('skips invalid record %# while retaining valid neighbors', (invalid) => {
    expect(
      parseLrclibSearchResponse([
        { ...record, ...invalid },
        { ...record, id: 456 },
      ]),
    ).toEqual([{ ...record, id: 456 }]);
  });

  it('deduplicates valid IDs preserving the first occurrence and source order', () => {
    expect(
      parseLrclibSearchResponse([
        record,
        { ...record, plainLyrics: 'Duplicate' },
        { ...record, id: 456 },
      ]),
    ).toEqual([record, { ...record, id: 456 }]);
  });

  it.each([
    { plainLyrics: 'Plain only', syncedLyrics: null },
    { plainLyrics: null, syncedLyrics: '[00:01.00] Synced only' },
    { plainLyrics: null, syncedLyrics: null },
    { instrumental: true, plainLyrics: null, syncedLyrics: null },
    {
      instrumental: true,
      plainLyrics: 'Upstream text',
      syncedLyrics: '[00:01] Upstream text',
    },
  ])('retains independent lyric fields and instrumental flag %#', (fields) => {
    expect(parseLrclibSearchResponse([{ ...record, ...fields }])).toEqual([
      { ...record, ...fields },
    ]);
  });

  it('preserves all Unicode, whitespace, headings, annotations and independent content exactly', () => {
    const original = {
      ...record,
      plainLyrics:
        '  [Verse: Tên nghệ sĩ]\r\nMột ngày mới\n안녕하세요\nCanción del corazón\n(annotation)\n\n',
      syncedLyrics: '\n[00:01.20] Nội dung khác\n[00:09.30] 별빛\n',
    };
    expect(parseLrclibSearchResponse([original])).toEqual([original]);
  });

  it('normalizes missing optional album/duration while preserving empty lyric strings', () => {
    expect(
      parseLrclibSearchResponse([
        {
          ...record,
          albumName: undefined,
          duration: undefined,
          plainLyrics: '',
          syncedLyrics: '',
        },
      ]),
    ).toEqual([
      {
        ...record,
        albumName: null,
        duration: null,
        plainLyrics: '',
        syncedLyrics: '',
      },
    ]);
  });
});
