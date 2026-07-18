import { useEffect, useRef } from "react";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import {
  logProjectionCacheHitRate,
  logProjectionFirstCachedContent,
  logProjectionFirstVisible,
  logProjectionPrefetchHit,
  logProjectionSkippedFirstNetworkPatch,
  logProjectionTimeToInteractive,
  logProjectionWarmupUsefulness,
} from "./projectionScreenTelemetry";
import { readProjectionPrefetch } from "./prefetch/prefetchRegistry";
import { useUiViewStateStore } from "./uiViewState";
import { clearScreenRequestTracking } from "./dataLoadingTelemetry";
import { getProjectionState } from "./projections";

/**
 * Refs shared between the telemetry hook and the sync hook.
 * Created once in the main composition hook and threaded through.
 */
export interface ProjectionTelemetryRefs {
  firstCachedContentTrackedRef: React.MutableRefObject<boolean>;
  firstInteractiveTrackedRef: React.MutableRefObject<boolean>;
  firstNetworkPatchTrackedRef: React.MutableRefObject<boolean>;
  mountedAtRef: React.MutableRefObject<number>;
}

/** Call once at the top of the composition hook to allocate stable refs. */
export function useProjectionTelemetryRefs(): ProjectionTelemetryRefs {
  return {
    firstCachedContentTrackedRef: useRef(false),
    firstInteractiveTrackedRef: useRef(false),
    firstNetworkPatchTrackedRef: useRef(false),
    mountedAtRef: useRef(Date.now()),
  };
}

export interface ProjectionScreenTelemetryParams {
  entity: string;
  fetchStatus: string;
  hasCachedSnapshot: boolean;
  interactiveReady: boolean;
  isError: boolean;
  itemCount: number;
  queryClient: QueryClient;
  queryScope: string;
  refs: ProjectionTelemetryRefs;
  stableQueryKey: QueryKey;
}

/**
 * Encapsulates all projection-screen telemetry effects:
 * cache-hit rate, prefetch-hit, first-visible, first-cached-content,
 * skipped-first-network-patch, and time-to-interactive.
 */
export function useProjectionScreenTelemetry({
  entity,
  fetchStatus,
  hasCachedSnapshot,
  interactiveReady,
  isError,
  itemCount,
  queryClient,
  queryScope,
  refs,
  stableQueryKey,
}: ProjectionScreenTelemetryParams): void {
  const {
    firstCachedContentTrackedRef,
    firstInteractiveTrackedRef,
    firstNetworkPatchTrackedRef,
    mountedAtRef,
  } = refs;
  const firstVisibleTrackedRef = useRef(false);

  // Mount/query-scope lifecycle: reset refs, capture cache path, and record prefetch hits once.
  useEffect(() => {
    firstVisibleTrackedRef.current = false;
    firstCachedContentTrackedRef.current = false;
    firstInteractiveTrackedRef.current = false;
    firstNetworkPatchTrackedRef.current = false;
    mountedAtRef.current = Date.now();
    const cachedState = getProjectionState(queryClient, stableQueryKey);
    const cachedCount = cachedState?.ids?.length || 0;
    logProjectionCacheHitRate({
      cachedIds: cachedCount,
      entity,
      hadCache: Boolean(cachedState),
      screenKey: queryScope,
    });
    const entry = readProjectionPrefetch(stableQueryKey);
    if (entry && (cachedState || cachedCount > 0)) {
      const ageMs = Math.max(0, Date.now() - entry.recordedAt);
      logProjectionPrefetchHit({
        ageMs,
        entity,
        itemCount: cachedCount,
        screenKey: queryScope,
        source: entry.source,
        status: entry.status,
      });
      if (entry.source === "warmup") {
        logProjectionWarmupUsefulness({
          ageMs,
          entity,
          itemCount: cachedCount,
          screenKey: queryScope,
        });
      }
    }

    return () => {
      clearScreenRequestTracking(queryScope);
    };
  }, [
    entity,
    queryClient,
    queryScope,
    stableQueryKey,
    firstCachedContentTrackedRef,
    firstInteractiveTrackedRef,
    firstNetworkPatchTrackedRef,
    mountedAtRef,
  ]);

  // First-content lifecycle: content rendered, first visible, and first cached content.
  useEffect(() => {
    if (!itemCount) return;
    useUiViewStateStore.getState().acknowledgeContentRendered(queryScope);
    if (!firstVisibleTrackedRef.current) {
      firstVisibleTrackedRef.current = true;
      logProjectionFirstVisible({
        durationMs: Math.max(0, Date.now() - mountedAtRef.current),
        entity,
        itemCount,
        screenKey: queryScope,
      });
    }
    if (!hasCachedSnapshot || firstCachedContentTrackedRef.current) return;
    firstCachedContentTrackedRef.current = true;
    logProjectionFirstCachedContent({
      durationMs: Math.max(0, Date.now() - mountedAtRef.current),
      entity,
      itemCount,
      screenKey: queryScope,
    });
  }, [
    entity,
    fetchStatus,
    firstNetworkPatchTrackedRef,
    hasCachedSnapshot,
    itemCount,
    queryScope,
    firstCachedContentTrackedRef,
    mountedAtRef,
  ]);

  // Interactive/update lifecycle: skipped patch telemetry and time-to-interactive.
  useEffect(() => {
    if (
      !firstNetworkPatchTrackedRef.current &&
      hasCachedSnapshot &&
      interactiveReady &&
      fetchStatus !== "fetching"
    ) {
      firstNetworkPatchTrackedRef.current = true;
      logProjectionSkippedFirstNetworkPatch({
        entity,
        screenKey: queryScope,
      });
    }
    if (firstInteractiveTrackedRef.current || !interactiveReady) return;
    firstInteractiveTrackedRef.current = true;
    logProjectionTimeToInteractive({
      durationMs: Math.max(0, Date.now() - mountedAtRef.current),
      entity,
      hadCache: hasCachedSnapshot,
      itemCount,
      screenKey: queryScope,
      status: isError ? "error" : "ok",
    });
  }, [
    entity,
    fetchStatus,
    firstNetworkPatchTrackedRef,
    hasCachedSnapshot,
    interactiveReady,
    itemCount,
    queryScope,
    isError,
    firstInteractiveTrackedRef,
    mountedAtRef,
  ]);
}
