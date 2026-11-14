import { QueryClient } from '@tanstack/react-query';

// One cache per popup app. Closing the popup destroys this in-memory client.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: false,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchInterval: false,
    },
    mutations: { retry: false },
  },
});
