import type { z } from 'zod';
import type {
  lyricsCriteriaSchema,
  lyricsRecordSchema,
  lyricsSearchResponseSchema,
} from '../schemas/lyrics.schema.ts';

export type LyricsCriteria = z.infer<typeof lyricsCriteriaSchema>;
export type LyricsRecord = z.infer<typeof lyricsRecordSchema>;
export type LyricsSearchResponse = z.infer<typeof lyricsSearchResponseSchema>;

export interface SyncedLyricLine {
  id: string;
  timeMs: number;
  text: string;
}
