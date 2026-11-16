import { QueryClient } from '@tanstack/react-query';
import { QUERY_CACHE_MAX_AGE } from '../lib/query-cache-persister.ts';

// One live cache per popup, restored by PersistQueryClientProvider.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: QUERY_CACHE_MAX_AGE,
      retry: false,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchInterval: false,
    },
    mutations: { retry: false },
  },
});
