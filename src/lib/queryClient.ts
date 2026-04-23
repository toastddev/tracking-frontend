import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => {
        // Don't retry auth failures — the user needs to log in again.
        if (err instanceof ApiError && err.status === 401) return false;
        return count < 2;
      },
    },
  },
});
