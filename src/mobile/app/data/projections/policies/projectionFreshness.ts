import type { ProjectionMergeMode } from "../projectionMerge";

export type ProjectionFirstOpenPolicy = "last-known-content" | "skeleton";
export type ProjectionPrefetchPolicy = "eager" | "intent" | "none" | "warmup";
export type ProjectionRealtimeScope = "critical" | "none" | "patchable";

export interface ProjectionFreshnessPolicy {
  firstOpenPolicy: ProjectionFirstOpenPolicy;
  freshnessSlaMs: number;
  prefetchPolicy: ProjectionPrefetchPolicy;
  realtimeScope: ProjectionRealtimeScope;
  refreshMode: ProjectionMergeMode;
}

const DEFAULT_PROJECTION_FRESHNESS_POLICY: ProjectionFreshnessPolicy = {
  firstOpenPolicy: "last-known-content",
  freshnessSlaMs: 3_000,
  prefetchPolicy: "intent",
  realtimeScope: "none",
  refreshMode: "delta",
};

export function resolveProjectionFreshnessPolicy(
  policy?: Partial<ProjectionFreshnessPolicy> | null,
): ProjectionFreshnessPolicy {
  return {
    ...DEFAULT_PROJECTION_FRESHNESS_POLICY,
    ...(policy || {}),
  };
}

export function shouldShowInitialProjectionSkeleton(params: {
  hasCachedSnapshot: boolean;
  itemCount: number;
  loading: boolean;
  policy: ProjectionFreshnessPolicy;
}) {
  if (params.itemCount > 0 || !params.loading) return false;
  if (params.hasCachedSnapshot && params.policy.firstOpenPolicy === "last-known-content") {
    return false;
  }
  return true;
}
