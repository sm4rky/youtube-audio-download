import type { SongSearchResponse } from '../types/song.ts';
import { songSearchResponseSchema, songDetailSchema } from '../schemas/songs.schema.ts';
import { apiClient } from './api-client.ts';

export async function searchSongs(
  query: string,
  signal?: AbortSignal,
): Promise<SongSearchResponse> {
  const { data } = await apiClient.get<unknown>('/songs/search', {
    params: { q: query },
    signal,
  });
  const result = songSearchResponseSchema.safeParse(data);
  if (!result.success) {
    throw new Error('The backend returned an invalid song search response.');
  }
  return result.data;
}

export async function getSongDetail(id: number, signal?: AbortSignal) {
  const { data } = await apiClient.get<unknown>('/songs/' + id, { signal });
  const result = songDetailSchema.safeParse(data);
  if (!result.success) throw new Error('The backend returned an invalid song detail response.');
  return result.data;
}
