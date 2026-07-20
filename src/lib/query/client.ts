import { QueryClient } from "@tanstack/react-query";

/** Shared QueryClient for Harbor — catalog, meta, and stream caches. */
export function createHarborQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Media metadata changes slowly; prefer cache during navigation.
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
