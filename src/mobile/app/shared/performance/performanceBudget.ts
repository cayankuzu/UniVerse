export type PerformanceTier = "tier1" | "tier2" | "tier3";
export type ProjectionFirstOpenPolicy = "last-known-content" | "skeleton";
export type ProjectionPrefetchPolicy = "eager" | "intent" | "none" | "warmup";
export type ProjectionRealtimeScope = "critical" | "none" | "patchable";
export type ProjectionMergeMode = "replace" | "append" | "delta";
export type ProjectionSurface =
  | "home"
  | "search"
  | "profile"
  | "view-profile"
  | "notifications"
  | "event-detail"
  | "relationships"
  | "blocked-users";

export interface StartupPerformanceBudget {
  cachePreviewImages: number;
  cachePreviewItems: number;
  criticalAboveFoldImages: number;
  criticalAboveFoldItems: number;
  firstFoldHomeLimit: number;
  idleImages: number;
  queryRestoreMaxWaitMs: number;
  splashMaxWaitMs: number;
  splashMinDisplayMs: number;
  warmupRpcTimeoutMs: number;
  warmupStaleMs: number;
}

export interface PrefetchPerformanceBudget {
  interactionDelayMs: number;
  maxNextPageImages: number;
  maxPriorityImages: number;
  maxTargetsPerBatch: number;
  visiblePercentThreshold: number;
  viewportMinimumViewTimeMs: number;
}

export interface ListPerformanceBudget {
  drawDistanceMultiplier: number;
}

export interface ProjectionPerformanceBudget {
  firstOpenPolicy: ProjectionFirstOpenPolicy;
  freshnessSlaMs: number;
  prefetchPolicy: ProjectionPrefetchPolicy;
  refreshBackgroundDelayMs: number;
  refreshMaxParallel: number;
  realtimeScope: ProjectionRealtimeScope;
  refreshMode: ProjectionMergeMode;
}

export const STARTUP_PERFORMANCE_BUDGET: StartupPerformanceBudget = {
  cachePreviewImages: 3,
  cachePreviewItems: 8,
  criticalAboveFoldImages: 4,
  criticalAboveFoldItems: 10,
  firstFoldHomeLimit: 5,
  idleImages: 3,
  queryRestoreMaxWaitMs: 350,
  splashMaxWaitMs: 900,
  splashMinDisplayMs: 0,
  // Non-blocking startup work gets enough time to finish on mobile networks.
  warmupRpcTimeoutMs: 900,
  warmupStaleMs: 15 * 60_000,
};

const PREFETCH_BUDGETS: Record<PerformanceTier, PrefetchPerformanceBudget> = {
  tier1: {
    interactionDelayMs: 32,
    maxNextPageImages: 2,
    maxPriorityImages: 4,
    maxTargetsPerBatch: 2,
    visiblePercentThreshold: 60,
    viewportMinimumViewTimeMs: 120,
  },
  tier2: {
    interactionDelayMs: 56,
    maxNextPageImages: 2,
    maxPriorityImages: 3,
    maxTargetsPerBatch: 2,
    visiblePercentThreshold: 68,
    viewportMinimumViewTimeMs: 160,
  },
  tier3: {
    interactionDelayMs: 80,
    maxNextPageImages: 1,
    maxPriorityImages: 2,
    maxTargetsPerBatch: 1,
    visiblePercentThreshold: 74,
    viewportMinimumViewTimeMs: 200,
  },
};

const LIST_BUDGETS: Record<PerformanceTier, ListPerformanceBudget> = {
  tier1: {
    drawDistanceMultiplier: 6,
  },
  tier2: {
    drawDistanceMultiplier: 5,
  },
  tier3: {
    drawDistanceMultiplier: 4,
  },
};

const PROJECTION_BUDGETS: Record<ProjectionSurface, ProjectionPerformanceBudget> = {
  "blocked-users": {
    firstOpenPolicy: "last-known-content",
    freshnessSlaMs: 10_000,
    prefetchPolicy: "none",
    refreshBackgroundDelayMs: 180,
    refreshMaxParallel: 1,
    realtimeScope: "none",
    refreshMode: "delta",
  },
  "event-detail": {
    firstOpenPolicy: "last-known-content",
    freshnessSlaMs: 20_000,
    prefetchPolicy: "intent",
    refreshBackgroundDelayMs: 140,
    refreshMaxParallel: 2,
    realtimeScope: "patchable",
    refreshMode: "delta",
  },
  home: {
    firstOpenPolicy: "last-known-content",
    freshnessSlaMs: 20_000,
    prefetchPolicy: "warmup",
    refreshBackgroundDelayMs: 120,
    refreshMaxParallel: 2,
    realtimeScope: "patchable",
    refreshMode: "delta",
  },
  notifications: {
    firstOpenPolicy: "last-known-content",
    freshnessSlaMs: 12_000,
    prefetchPolicy: "intent",
    refreshBackgroundDelayMs: 220,
    refreshMaxParallel: 1,
    realtimeScope: "critical",
    refreshMode: "replace",
  },
  profile: {
    firstOpenPolicy: "last-known-content",
    freshnessSlaMs: 20_000,
    prefetchPolicy: "intent",
    refreshBackgroundDelayMs: 140,
    refreshMaxParallel: 2,
    realtimeScope: "patchable",
    refreshMode: "delta",
  },
  relationships: {
    firstOpenPolicy: "last-known-content",
    freshnessSlaMs: 30_000,
    prefetchPolicy: "none",
    refreshBackgroundDelayMs: 180,
    refreshMaxParallel: 1,
    realtimeScope: "patchable",
    refreshMode: "delta",
  },
  search: {
    firstOpenPolicy: "last-known-content",
    freshnessSlaMs: 30_000,
    prefetchPolicy: "intent",
    refreshBackgroundDelayMs: 160,
    refreshMaxParallel: 1,
    realtimeScope: "none",
    refreshMode: "replace",
  },
  "view-profile": {
    firstOpenPolicy: "last-known-content",
    freshnessSlaMs: 20_000,
    prefetchPolicy: "intent",
    refreshBackgroundDelayMs: 140,
    refreshMaxParallel: 2,
    realtimeScope: "patchable",
    refreshMode: "delta",
  },
};

export function resolvePrefetchPerformanceBudget(tier: PerformanceTier = "tier1") {
  return PREFETCH_BUDGETS[tier];
}

export function resolveListPerformanceBudget(tier: PerformanceTier = "tier1") {
  return LIST_BUDGETS[tier];
}

export function resolveProjectionPerformanceBudget(surface: ProjectionSurface) {
  return PROJECTION_BUDGETS[surface];
}
