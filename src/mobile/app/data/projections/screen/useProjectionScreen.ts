import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import type { ProjectionQueryOptions } from "../contracts";
import { createStableQueryOptions } from "../../query/options";
import { registerProjectionSync, unregisterProjectionSync } from "../sync/syncOrchestrator";
import { useScreenSync } from "../sync/useScreenSync";
import {
  getProjectionState,
  hasProjectionSnapshot,
  readProjectionItems,
  serializeProjectionKey,
} from "../projections";
import { createProjectionScreenState, type ProjectionScreenState } from "../projectionMerge";
import {
  resolveProjectionFreshnessPolicy,
  shouldShowInitialProjectionSkeleton,
} from "../policies/projectionFreshness";
import {
  useProjectionScreenTelemetry,
  useProjectionTelemetryRefs,
} from "../useProjectionScreenTelemetry";
import { useProjectionSync } from "../sync/useProjectionSync";
import { useProjectionLoadMore } from "./useProjectionLoadMore";
import { STANDARD_LIST_PAGE_SIZE } from "../cacheConfig";

export function useProjectionScreen<T extends { id?: string }>({
  autoRefreshOnFocus = false,
  cacheWarmStaleTime,
  enabled = true,
  entity,
  fetchProjection,
  getId,
  pageSize = STANDARD_LIST_PAGE_SIZE,
  policy,
  queryKey,
  refreshMode = "replace",
  skipIfFreshMs = 0,
  staleTime = 10_000,
}: ProjectionQueryOptions<T>) {
  const queryClient = useQueryClient();
  const resolvedPolicy = useMemo(() => resolveProjectionFreshnessPolicy(policy), [policy]);
  const freshnessSlaMs = resolvedPolicy.freshnessSlaMs;
  const prefetchPolicy = resolvedPolicy.prefetchPolicy;
  const queryScope = useMemo(() => serializeProjectionKey(queryKey), [queryKey]);
  const stableQueryKeyRef = useRef<{ key: QueryKey; scope: string }>({
    key: queryKey,
    scope: queryScope,
  });
  if (stableQueryKeyRef.current.scope !== queryScope) {
    stableQueryKeyRef.current = {
      key: queryKey,
      scope: queryScope,
    };
  }
  const stableQueryKey = stableQueryKeyRef.current.key;
  const cachedScreenState = getProjectionState(queryClient, stableQueryKey);
  const hasCachedSnapshot = hasProjectionSnapshot(queryClient, stableQueryKey);
  const cachedItemCount =
    (cachedScreenState?.ids?.length || 0) > 0
      ? readProjectionItems<T>(queryClient, stableQueryKey, entity).length
      : 0;
  const hasRenderableCachedContent = cachedItemCount > 0;
  const shouldRepairCachedSnapshotOnMount = hasCachedSnapshot && !hasRenderableCachedContent;
  const initialSyncSeedRef = useRef<{ scope: string; syncedAt: number }>({
    scope: queryScope,
    syncedAt:
      cachedScreenState?.isStale || shouldRepairCachedSnapshotOnMount
        ? 0
        : cachedScreenState?.touchedAt || 0,
  });
  if (initialSyncSeedRef.current.scope !== queryScope) {
    initialSyncSeedRef.current = {
      scope: queryScope,
      syncedAt:
        cachedScreenState?.isStale || shouldRepairCachedSnapshotOnMount
          ? 0
          : cachedScreenState?.touchedAt || 0,
    };
  }
  const initialLastSyncedAt = initialSyncSeedRef.current.syncedAt;
  const effectiveRefreshMode = resolvedPolicy.refreshMode || refreshMode;

  // Shared telemetry refs (allocated once, threaded to sync & telemetry hooks)
  const telemetryRefs = useProjectionTelemetryRefs();

  // --- Sync & envelope normalization ---
  const { normalizeLegacyEnvelope, syncProjection } = useProjectionSync<T>({
    effectiveRefreshMode,
    enabled,
    entity,
    fetchProjection,
    firstNetworkPatchTrackedRef: telemetryRefs.firstNetworkPatchTrackedRef,
    getId,
    mountedAtRef: telemetryRefs.mountedAtRef,
    pageSize,
    queryClient,
    queryScope,
    resolvedPolicy,
    stableQueryKey,
  });

  useEffect(() => {
    normalizeLegacyEnvelope();
  }, [normalizeLegacyEnvelope, queryScope]);

  const effectiveStaleTime =
    hasRenderableCachedContent && cacheWarmStaleTime !== undefined ? cacheWarmStaleTime : staleTime;
  const shouldRefetchProjectionOnMount =
    shouldRepairCachedSnapshotOnMount ||
    (!hasRenderableCachedContent && cachedScreenState?.isStale);

  const screenQuery = useQuery<ProjectionScreenState>({
    ...createStableQueryOptions(effectiveStaleTime),
    enabled,
    placeholderData: (previousData) => previousData,
    refetchOnMount: shouldRefetchProjectionOnMount ? "always" : false,
    queryFn: async () => {
      const cachedState = getProjectionState(queryClient, stableQueryKey);
      const useDelta =
        hasCachedSnapshot &&
        effectiveRefreshMode === "delta" &&
        (cachedState?.ids?.length || 0) > 0;
      return (
        (await syncProjection(useDelta ? "delta" : "replace")) ||
        createProjectionScreenState({
          ids: [],
          nextCursor: null,
          serverTime: null,
        })
      );
    },
    queryKey: stableQueryKey,
  });

  const nextItems = readProjectionItems<T>(queryClient, stableQueryKey, entity);
  const stableItemsRef = useRef<{ items: T[]; scope: string }>({
    items: nextItems,
    scope: queryScope,
  });
  const itemsChanged =
    stableItemsRef.current.scope !== queryScope ||
    stableItemsRef.current.items.length !== nextItems.length ||
    nextItems.some((item, index) => item !== stableItemsRef.current.items[index]);
  if (itemsChanged) {
    stableItemsRef.current = { items: nextItems, scope: queryScope };
  }
  const items = stableItemsRef.current.items;

  const shouldShowInitialSkeleton = shouldShowInitialProjectionSkeleton({
    hasCachedSnapshot: hasRenderableCachedContent,
    itemCount: items.length,
    loading:
      screenQuery.isLoading ||
      (screenQuery.fetchStatus === "fetching" && !hasRenderableCachedContent && items.length === 0),
    policy: resolvedPolicy,
  });
  const interactiveReady =
    enabled &&
    !shouldShowInitialSkeleton &&
    (hasRenderableCachedContent ||
      items.length > 0 ||
      screenQuery.isFetched ||
      screenQuery.isError);
  const runBackgroundProjectionRefresh = useCallback(async () => {
    await syncProjection(effectiveRefreshMode);
  }, [effectiveRefreshMode, syncProjection]);
  const runManualProjectionRefresh = useCallback(async () => {
    await syncProjection("replace");
  }, [syncProjection]);

  // --- Telemetry effects ---
  useProjectionScreenTelemetry({
    entity,
    fetchStatus: screenQuery.fetchStatus,
    hasCachedSnapshot,
    interactiveReady,
    isError: screenQuery.isError,
    itemCount: items.length,
    queryClient,
    queryScope,
    refs: telemetryRefs,
    stableQueryKey,
  });

  // --- Screen sync (pull-to-refresh / background) ---
  const { backgroundRefreshing, lastSyncedAt, onRefresh, refreshing } = useScreenSync({
    autoRefreshOnFocus,
    backgroundSkipIfFreshMs: Math.max(skipIfFreshMs, freshnessSlaMs),
    backgroundRefresh: runBackgroundProjectionRefresh,
    criticalRefresh: runManualProjectionRefresh,
    enabled,
    initialLastSyncedAt,
    manualPendingMaxMs: hasRenderableCachedContent || items.length > 0 ? 1200 : 0,
    manualSkipIfFreshMs: 0,
    screenKey: queryScope,
    skipIfFreshMs,
  });

  // --- Load-more / pagination ---
  const { loadMore, loadingMore } = useProjectionLoadMore({
    entity,
    queryClient,
    queryScope,
    stableQueryKey,
    syncProjection,
  });
  const resolvedScreenState = screenQuery.data || getProjectionState(queryClient, stableQueryKey);
  const showPaginationState =
    Boolean(resolvedScreenState) &&
    !backgroundRefreshing &&
    !refreshing &&
    screenQuery.fetchStatus !== "fetching";
  const hasMore = showPaginationState
    ? resolvedScreenState?.isStale
      ? undefined
      : Boolean(resolvedScreenState?.nextCursor)
    : undefined;

  // --- Sync orchestrator registration ---
  useEffect(() => {
    if (!enabled) return undefined;
    registerProjectionSync(queryScope, {
      entity,
      freshnessSlaMs,
      initialLastSyncedAt,
      isStale: () => Boolean(getProjectionState(queryClient, stableQueryKey)?.isStale),
      prefetchPolicy,
      queryKey: stableQueryKey,
      sync: runBackgroundProjectionRefresh,
    });
    return () => {
      unregisterProjectionSync(queryScope);
    };
  }, [
    enabled,
    entity,
    freshnessSlaMs,
    initialLastSyncedAt,
    prefetchPolicy,
    queryClient,
    queryScope,
    runBackgroundProjectionRefresh,
    stableQueryKey,
  ]);

  return {
    backgroundRefreshing,
    data: items,
    hasCachedSnapshot,
    hasMore,
    items,
    lastSyncedAt,
    loadMore,
    loadingMore,
    onBackgroundRefresh: runBackgroundProjectionRefresh,
    onRefresh,
    policy: resolvedPolicy,
    query: screenQuery,
    refreshing,
    screenState: screenQuery.data,
    shouldShowInitialSkeleton,
    syncProjection,
  };
}
