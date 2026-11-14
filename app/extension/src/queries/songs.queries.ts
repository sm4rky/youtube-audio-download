import { queryOptions } from '@tanstack/react-query';
import { searchSongs } from '../api/songs.api.ts';
import {
  SEARCH_QUERY_MAX_LENGTH,
  searchQueryLength,
  validateManualQuery,
} from '../lib/song-title-normalizer.ts';

export function songSearchOptions(query: string) {
  // Manual queries are trimmed only; normalization belongs to the title flow.
  const value = query.trim();
  const length = searchQueryLength(value);
  return queryOptions({
    queryKey: ['songs', 'search', value] as const,
    // Guard imperative query callers too: fetchQuery does not honor enabled.
    queryFn: ({ signal }) => searchSongs(validateManualQuery(value), signal),
    enabled: length >= 1 && length <= SEARCH_QUERY_MAX_LENGTH,
  });
}
