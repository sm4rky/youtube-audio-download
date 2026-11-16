import { z } from 'zod';
import { geniusIdSchema, songDetailSchema } from './songs.schema.ts';

export const songDraftMetadataSchema = songDetailSchema.pick({
  title: true,
  primaryArtists: true,
  featuredArtists: true,
  album: true,
  year: true,
  coverUrl: true,
});

export const songDraftValuesSchema = z.object({
  metadata: songDraftMetadataSchema,
  plainLyrics: z.string().nullable(),
  syncedLyrics: z.string().nullable(),
});

export const songDraftSchema = z.object({
  videoId: z.string().min(1),
  geniusId: geniusIdSchema,
  lrclibId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
  original: songDraftValuesSchema,
  current: songDraftValuesSchema,
});

export const songDraftStateSchema = z.object({ draft: songDraftSchema.nullable() });
