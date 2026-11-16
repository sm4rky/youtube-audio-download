import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Query } from '@tanstack/react-query';
import { chromeSessionStorage } from './chrome-session-storage.ts';

// Persist successful search/detail data so it can be restored after the popup closes.
// The cache is valid for up to 24 hours, within the lifetime of Chrome session storage.
export const QUERY_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

// Adapt the query cache to storage: serialize/write, read/deserialize, and remove it.
export const queryCachePersister = createAsyncStoragePersister({
  storage: chromeSessionStorage,
  key: 'audiomint-search-cache-v1',
  // Write without a throttle delay because the popup may close as soon as results arrive.
  throttleTime: 0,
});

// Configure PersistQueryClientProvider, which coordinates cache saving and restoration.
export const queryCachePersistOptions = {
  persister: queryCachePersister,
  // Discard incompatible cache from older persistence configurations.
  buster: 'audiomint-query-v2',
  // Discard saved cache older than this limit when restoring it.
  maxAge: QUERY_CACHE_MAX_AGE,
  // Dehydration selects the cache entries to serialize for storage.
  dehydrateOptions: {
    // Mutation state is excluded from the saved cache.
    shouldDehydrateMutation: () => false,
    // Save only successful song-search and song-detail queries with valid key shapes.
    shouldDehydrateQuery: (query: Query) =>
      query.state.status === 'success' &&
      query.queryKey.length === 3 &&
      query.queryKey[0] === 'songs' &&
      ((query.queryKey[1] === 'search' && typeof query.queryKey[2] === 'string') ||
        (query.queryKey[1] === 'detail' && Number.isSafeInteger(query.queryKey[2]) && Number(query.queryKey[2]) > 0)),
  },
};
