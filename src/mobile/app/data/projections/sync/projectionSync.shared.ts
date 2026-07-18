import type { MutableRefObject } from "react";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { ProjectionEnvelope } from "../../query/contracts";
import type { ProjectionFetchContext } from "../contracts";
import type { ProjectionFreshnessPolicy } from "../policies/projectionFreshness";
import type { ProjectionMergeMode, ProjectionScreenState } from "../projectionMerge";
import {
  logProjectionBroadRefetch,
  logProjectionFirstNetworkPatch,
  logProjectionPayload,
  startProjectionSyncTimer,
} from "../projectionScreenTelemetry";
import { applyProjectionEnvelope, getProjectionState } from "../projections";
import { useUiViewStateStore } from "../uiViewState";
import { trackScreenRequest } from "../dataLoadingTelemetry";
import { noteProjectionSync } from "./syncOrchestrator";

export interface ProjectionSyncRuntime<T extends { id?: string }> {
  effectiveRefreshMode: ProjectionMergeMode;
  enabled: boolean;
  entity: string;
  fetchProjection: (context: ProjectionFetchContext) => Promise<ProjectionEnvelope<T>>;
  firstNetworkPatchTrackedRef: MutableRefObject<boolean>;
  getId?: (item: T) => string;
  mountedAtRef: MutableRefObject<number>;
  pageSize: number;
  queryClient: QueryClient;
  queryScope: string;
  resolvedPolicy: ProjectionFreshnessPolicy;
  stableQueryKey: QueryKey;
}

const inflightProjectionSyncs = new Map<string, Promise<ProjectionScreenState | undefined>>();

function resolveInflightProjectionSyncKey(queryScope: string, mode: ProjectionMergeMode) {
  return mode === "append" ? `${queryScope}:append` : queryScope;
}

function readLegacyProjectionEnvelope<T extends { id?: string }>(
  queryClient: QueryClient,
  stableQueryKey: QueryKey,
) {
  const cached = queryClient.getQueryData(stableQueryKey) as
    ProjectionScreenState | ProjectionEnvelope<T> | null | undefined;
  if (!cached || typeof cached !== "object") return null;
  if ("ids" in cached && Array.isArray(cached.ids)) return null;
  if (!("items" in cached) || !Array.isArray(cached.items)) return null;
  return cached;
}

function resolveProjectionSyncMode(params: {
  current: ProjectionScreenState | undefined;
  requestedMode: ProjectionMergeMode;
}) {
  const { current, requestedMode } = params;
  if (requestedMode === "append") return "append";
  if (current?.forceRefreshMode === "replace") return "replace";
  if (requestedMode === "delta" && (current?.ids?.length || 0) === 0) {
    return "replace";
  }
  return requestedMode;
}

function buildProjectionFetchContext(
  current: ProjectionScreenState | undefined,
  mode: ProjectionMergeMode,
  pageSize: number,
): ProjectionFetchContext {
  return {
    cursor: mode === "append" ? current?.nextCursor || null : null,
    deltaToken: mode === "delta" ? current?.deltaToken || null : null,
    limit: pageSize,
    mode,
    since: mode === "delta" ? current?.serverTime || null : null,
  };
}

function finalizeProjectionSync<T extends { id?: string }>(params: {
  current: ProjectionScreenState | undefined;
  envelope: ProjectionEnvelope<T>;
  mode: ProjectionMergeMode;
  runtime: ProjectionSyncRuntime<T>;
}) {
  const { current, envelope, mode, runtime } = params;
  const nextState = applyProjectionEnvelope({
    entity: runtime.entity,
    envelope,
    getId: runtime.getId,
    mode,
    queryClient: runtime.queryClient,
    screenKey: runtime.stableQueryKey,
  });
  noteProjectionSync(runtime.queryScope);
  const payloadSize =
    (envelope.items?.length || 0) +
    (envelope.updatedItems?.length || 0) +
    (envelope.deletedIds?.length || 0);

  logProjectionPayload({
    deletedCount: envelope.deletedIds?.length || 0,
    entity: runtime.entity,
    hadCache: Boolean(current),
    itemCount: envelope.items?.length || 0,
    mode,
    payloadSize,
    screenKey: runtime.queryScope,
    updatedCount: envelope.updatedItems?.length || 0,
  });
  if (payloadSize > 0) {
    useUiViewStateStore.getState().markNewContentAvailable(runtime.queryScope);
  }
  if (!runtime.firstNetworkPatchTrackedRef.current) {
    runtime.firstNetworkPatchTrackedRef.current = true;
    logProjectionFirstNetworkPatch({
      durationMs: Math.max(0, Date.now() - runtime.mountedAtRef.current),
      entity: runtime.entity,
      mode,
      payloadSize,
      screenKey: runtime.queryScope,
    });
  }

  return {
    nextState,
    payloadSize,
  };
}

export function normalizeLegacyProjectionEnvelope<T extends { id?: string }>(
  runtime: ProjectionSyncRuntime<T>,
) {
  const cached = readLegacyProjectionEnvelope<T>(runtime.queryClient, runtime.stableQueryKey);
  if (!cached) return;
  applyProjectionEnvelope({
    entity: runtime.entity,
    envelope: cached,
    getId: runtime.getId,
    mode: "replace",
    queryClient: runtime.queryClient,
    screenKey: runtime.stableQueryKey,
  });
}

export async function runProjectionSyncRequest<T extends { id?: string }>(
  runtime: ProjectionSyncRuntime<T>,
  requestedMode?: ProjectionMergeMode,
) {
  if (!runtime.enabled) {
    return getProjectionState(runtime.queryClient, runtime.stableQueryKey) || undefined;
  }

  const current = getProjectionState(runtime.queryClient, runtime.stableQueryKey) || undefined;
  const resolvedMode = resolveProjectionSyncMode({
    current,
    requestedMode: requestedMode || runtime.effectiveRefreshMode,
  });
  const inflightKey = resolveInflightProjectionSyncKey(runtime.queryScope, resolvedMode);
  const inflightSync = inflightProjectionSyncs.get(inflightKey);
  if (inflightSync) {
    return inflightSync;
  }

  trackScreenRequest(runtime.queryScope, `sync:${resolvedMode}`);
  const syncPromise = (async () => {
    const stopProjectionTelemetry = startProjectionSyncTimer({
      entity: runtime.entity,
      mode: resolvedMode,
      prefetchPolicy: runtime.resolvedPolicy.prefetchPolicy,
      realtimeScope: runtime.resolvedPolicy.realtimeScope,
      screenKey: runtime.queryScope,
    });
    try {
      if (resolvedMode === "replace" && current) {
        logProjectionBroadRefetch({
          entity: runtime.entity,
          mode: resolvedMode,
          screenKey: runtime.queryScope,
        });
      }
      const envelope = await runtime.fetchProjection(
        buildProjectionFetchContext(current, resolvedMode, runtime.pageSize),
      );
      const { nextState, payloadSize } = finalizeProjectionSync({
        current,
        envelope,
        mode: resolvedMode,
        runtime,
      });
      stopProjectionTelemetry("ok", {
        deltaPayloadSize: payloadSize,
        deletedCount: envelope.deletedIds?.length || 0,
        itemCount: envelope.items?.length || 0,
        updatedCount: envelope.updatedItems?.length || 0,
      });
      return nextState;
    } catch (error) {
      stopProjectionTelemetry("error", {
        message: String((error as { message?: string })?.message || error || ""),
      });
      throw error;
    }
  })();
  inflightProjectionSyncs.set(inflightKey, syncPromise);
  const clearInflightSync = () => {
    if (inflightProjectionSyncs.get(inflightKey) === syncPromise) {
      inflightProjectionSyncs.delete(inflightKey);
    }
  };
  void syncPromise.then(clearInflightSync, clearInflightSync);
  return syncPromise;
}
