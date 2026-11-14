import { z } from 'zod';

const geniusIdSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const nonBlankStringSchema = z.string().refine((value) => value.trim().length > 0);

export const songArtistSchema = z.object({
  geniusId: geniusIdSchema,
  name: nonBlankStringSchema,
});

export const songSummarySchema = z.object({
  geniusId: geniusIdSchema,
  title: nonBlankStringSchema,
  artistName: nonBlankStringSchema,
  primaryArtists: z.array(songArtistSchema),
  featuredArtists: z.array(songArtistSchema),
  year: z.number().int().min(1).max(9999).nullable(),
  coverUrl: z.string().nullable(),
  geniusUrl: z.string().nullable(),
});

export const songSearchResponseSchema = z.object({
  query: z.string(),
  items: z.array(songSummarySchema),
});
