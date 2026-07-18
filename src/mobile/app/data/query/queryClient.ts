import { QueryClient } from "@tanstack/react-query";
import { attachQueryInvalidationGuard } from "./guards";
import { DEFAULT_QUERY_GC_TIME, createStableQueryOptions } from "./options";
import { getQueryRetryDelay, shouldRetryQuery } from "./retryPolicy";

export const queryClient = attachQueryInvalidationGuard(
  new QueryClient({
    defaultOptions: {
      queries: {
        ...createStableQueryOptions(),
        gcTime: DEFAULT_QUERY_GC_TIME,
        retry: shouldRetryQuery,
        retryDelay: getQueryRetryDelay,
        structuralSharing: true,
      },
      mutations: {
        retry: 0,
      },
    },
  }),
);
