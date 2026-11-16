import { queryOptions } from '@tanstack/react-query';
import { searchLyrics } from '../api/lyrics.api.ts';
import { lyricsCriteriaSchema } from '../schemas/lyrics.schema.ts';
import type { LyricsCriteria } from '../types/lyrics.ts';

export function lyricsSearchOptions(criteria: LyricsCriteria | null) {
  const result = lyricsCriteriaSchema.safeParse(criteria);
  const value = result.success ? result.data : null;
  return queryOptions({
    queryKey: ['lyrics', 'search', value] as const,
    enabled: value !== null,
    queryFn: ({ signal }) => {
      // fetchQuery does not honor enabled, so validate imperative callers as well.
      const parsed = lyricsCriteriaSchema.parse(value);
      return searchLyrics(parsed, signal);
    },
  });
}
