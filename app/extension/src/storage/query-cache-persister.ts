import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Query } from '@tanstack/react-query';
import { sessionStorage } from './session-storage.ts';

export const SEARCH_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

export const queryCachePersister = createAsyncStoragePersister({
  storage: sessionStorage,
  key: 'audiomint-search-cache-v1',
  // A popup can close immediately after results arrive.
  throttleTime: 0,
});

export function searchCacheOptions(videoId: string | null) {
  return {
    persister: queryCachePersister,
    buster: `audiomint-search-v1:${videoId ?? 'no-video'}`,
    maxAge: SEARCH_CACHE_MAX_AGE,
    dehydrateOptions: {
      shouldDehydrateMutation: () => false,
      shouldDehydrateQuery: (query: Query) =>
        query.state.status === 'success' &&
        query.queryKey.length === 3 &&
        query.queryKey[0] === 'songs' &&
        query.queryKey[1] === 'search' &&
        typeof query.queryKey[2] === 'string',
    },
  };
}
