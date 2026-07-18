import { useCallback, useRef, type MutableRefObject } from "react";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { ProjectionEnvelope } from "../../query/contracts";
import type { ProjectionFetchContext } from "../contracts";
import type { ProjectionMergeMode } from "../projectionMerge";
import type { ProjectionFreshnessPolicy } from "../policies/projectionFreshness";
import {
  normalizeLegacyProjectionEnvelope,
  runProjectionSyncRequest,
  type ProjectionSyncRuntime,
} from "./projectionSync.shared";

export interface UseProjectionSyncParams<T extends { id?: string }> {
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

/**
 * Extracts the syncProjection callback and legacy envelope normalization.
 */
export function useProjectionSync<T extends { id?: string }>({
  effectiveRefreshMode,
  enabled,
  entity,
  fetchProjection,
  firstNetworkPatchTrackedRef,
  getId,
  mountedAtRef,
  pageSize,
  queryClient,
  queryScope,
  resolvedPolicy,
  stableQueryKey,
}: UseProjectionSyncParams<T>) {
  const runtimeRef = useRef<ProjectionSyncRuntime<T>>({
    effectiveRefreshMode,
    enabled,
    entity,
    fetchProjection,
    firstNetworkPatchTrackedRef,
    getId,
    mountedAtRef,
    pageSize,
    queryClient,
    queryScope,
    resolvedPolicy,
    stableQueryKey,
  });
  runtimeRef.current = {
    effectiveRefreshMode,
    enabled,
    entity,
    fetchProjection,
    firstNetworkPatchTrackedRef,
    getId,
    mountedAtRef,
    pageSize,
    queryClient,
    queryScope,
    resolvedPolicy,
    stableQueryKey,
  };

  const normalizeLegacyEnvelope = useCallback(() => {
    normalizeLegacyProjectionEnvelope(runtimeRef.current);
  }, []);

  const syncProjection = useCallback(
    (requestedMode?: ProjectionMergeMode) =>
      runProjectionSyncRequest(runtimeRef.current, requestedMode),
    [],
  );

  return { normalizeLegacyEnvelope, syncProjection };
}
