import type { QueryClient, QueryFilters, QueryKey } from "@tanstack/react-query";
import { logProjectionMetric } from "../../platform/observability";
import { serializeProjectionKey } from "../projections/projections";

const BLOCKED_IMMEDIATE_INVALIDATIONS: readonly QueryKey[] = [
  ["events", "feed"],
  ["albums", "feed"],
  ["notifications", "list"],
  ["profile", "list"],
  ["profile", "events"],
  ["profile", "albums"],
  ["profile", "clubs"],
  ["screen", "home"],
  ["screen", "search"],
  ["screen", "notifications"],
  ["screen", "profile-overview"],
  ["screen", "profile-content"],
  ["screen", "relationships"],
  ["screen", "event-detail"],
  ["screen", "album-event"],
];

function matchesBlockedPrefix(queryKey: QueryKey, blockedPrefix: QueryKey) {
  if (!Array.isArray(queryKey) || !Array.isArray(blockedPrefix)) return false;
  if (queryKey.length < blockedPrefix.length) return false;
  return blockedPrefix.every((segment, index) => queryKey[index] === segment);
}

function resolveGuardedScreenKey(queryKey: QueryKey | undefined) {
  if (!Array.isArray(queryKey) || queryKey.length === 0) return undefined;
  return serializeProjectionKey(queryKey);
}

export function shouldDisableImmediateInvalidation(queryKey: QueryKey | undefined) {
  if (!Array.isArray(queryKey) || queryKey.length === 0) return false;
  return BLOCKED_IMMEDIATE_INVALIDATIONS.some((blockedPrefix) =>
    matchesBlockedPrefix(queryKey, blockedPrefix),
  );
}

export function applyInvalidationGuard<TFilters extends QueryFilters>(
  filters?: TFilters,
): TFilters | undefined {
  if (!filters || !Array.isArray(filters.queryKey)) return filters;
  if (!shouldDisableImmediateInvalidation(filters.queryKey)) return filters;
  return {
    ...filters,
    refetchType: "none",
  } as TFilters;
}

export function attachQueryInvalidationGuard(queryClient: QueryClient) {
  const originalInvalidateQueries = queryClient.invalidateQueries.bind(queryClient);
  const originalRemoveQueries = queryClient.removeQueries.bind(queryClient);
  queryClient.invalidateQueries = ((filters?: QueryFilters, options?: unknown) => {
    if (filters?.queryKey && shouldDisableImmediateInvalidation(filters.queryKey)) {
      logProjectionMetric({
        meta: {
          action: "invalidateQueries",
          reason: "guarded-projection-refetch-blocked",
          queryKey: filters.queryKey,
        },
        name: "broad_refetch_count",
        screenKey: resolveGuardedScreenKey(filters.queryKey),
        status: "rollback",
      });
    }
    return originalInvalidateQueries(applyInvalidationGuard(filters), options as never);
  }) as typeof queryClient.invalidateQueries;
  queryClient.removeQueries = ((filters?: QueryFilters) => {
    if (filters?.queryKey && shouldDisableImmediateInvalidation(filters.queryKey)) {
      logProjectionMetric({
        meta: {
          action: "removeQueries",
          reason: "guarded-projection-scope-reset",
          queryKey: filters.queryKey,
        },
        name: "projection_scope_reset",
        screenKey: resolveGuardedScreenKey(filters.queryKey),
        status: "ok",
      });
    }
    return originalRemoveQueries(filters);
  }) as typeof queryClient.removeQueries;
  return queryClient;
}
