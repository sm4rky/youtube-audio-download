import type { z } from 'zod';
import type {
  songArtistSchema,
  songSummarySchema,
  songSearchResponseSchema,
} from '../schemas/songs.schema.ts';

export type SongArtist = z.infer<typeof songArtistSchema>;
export type SongSummary = z.infer<typeof songSummarySchema>;
export type SongSearchResponse = z.infer<typeof songSearchResponseSchema>;
