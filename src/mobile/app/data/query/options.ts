export const DEFAULT_QUERY_STALE_TIME = 10_000;
// Increased: keep unused queries alive longer so screen re-entry is instant
export const DEFAULT_QUERY_GC_TIME = 30 * 60_000;

export function createStableQueryOptions(staleTime = DEFAULT_QUERY_STALE_TIME) {
  return {
    staleTime,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  };
}
