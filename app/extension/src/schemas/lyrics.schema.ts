import { z } from 'zod';

export const lyricsCriteriaSchema = z.object({
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().min(1).max(200),
  album: z.string().trim().min(1).max(200).optional(),
  duration: z.number().positive().finite().optional(),
});

export const lyricsRecordSchema = z.object({
  lrclibId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  trackName: z.string(),
  artistName: z.string(),
  albumName: z.string().nullable(),
  duration: z.number().nonnegative().finite().nullable(),
  instrumental: z.boolean(),
  plainLyrics: z.string().nullable(),
  syncedLyrics: z.string().nullable(),
});

export const lyricsSearchResponseSchema = z.object({
  query: z.object({
    title: z.string(),
    artist: z.string(),
    album: z.string().nullable(),
    duration: z.number().positive().finite().nullable(),
  }),
  lyrics: lyricsRecordSchema.nullable(),
});
