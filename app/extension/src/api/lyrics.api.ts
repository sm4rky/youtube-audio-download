import { apiClient } from './api-client.ts';
import { lyricsSearchResponseSchema } from '../schemas/lyrics.schema.ts';
import type { LyricsCriteria, LyricsSearchResponse } from '../types/lyrics.ts';

export async function searchLyrics(
  criteria: LyricsCriteria,
  signal?: AbortSignal,
): Promise<LyricsSearchResponse> {
  const { data } = await apiClient.get<unknown>('/lyrics/search', {
    params: criteria,
    signal,
  });
  const result = lyricsSearchResponseSchema.safeParse(data);
  if (!result.success) {
    throw new Error('The backend returned an invalid lyrics response.');
  }
  return result.data;
}
