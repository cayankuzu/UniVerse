import {
  logProjectionMetric,
  logScreenView,
  startObservedTimer,
} from "../../platform/observability";

export function startProjectionSyncTimer(params: {
  entity: string;
  mode: string;
  prefetchPolicy?: string;
  realtimeScope?: string;
  screenKey: string;
}) {
  const { entity, mode, prefetchPolicy, realtimeScope, screenKey } = params;
  return startObservedTimer({
    category: "projection",
    meta: {
      entity,
      mode,
      prefetchPolicy,
      realtimeScope,
    },
    name: `${entity}:sync`,
    screenKey,
  });
}

export function logProjectionBroadRefetch(params: {
  entity: string;
  mode: string;
  screenKey: string;
}) {
  logProjectionMetric({
    meta: { entity: params.entity, mode: params.mode },
    name: "broad_refetch_count",
    screenKey: params.screenKey,
    status: "ok",
  });
}

export function logProjectionPayload(params: {
  deletedCount: number;
  entity: string;
  hadCache: boolean;
  itemCount: number;
  mode: string;
  payloadSize: number;
  screenKey: string;
  updatedCount: number;
}) {
  logProjectionMetric({
    meta: {
      deletedCount: params.deletedCount,
      entity: params.entity,
      hadCache: params.hadCache,
      itemCount: params.itemCount,
      mode: params.mode,
      payloadSize: params.payloadSize,
      updatedCount: params.updatedCount,
    },
    name: "delta_payload_size",
    screenKey: params.screenKey,
    status: "ok",
  });
}

export function logProjectionCacheHitRate(params: {
  cachedIds: number;
  entity: string;
  hadCache: boolean;
  screenKey: string;
}) {
  logProjectionMetric({
    meta: {
      cachedIds: params.cachedIds,
      entity: params.entity,
      hadCache: params.hadCache,
      rate: params.hadCache ? 1 : 0,
    },
    name: "cache_hit_rate",
    screenKey: params.screenKey,
    status: params.hadCache ? "ok" : "skipped",
  });
}

export function logProjectionPrefetchHit(params: {
  ageMs: number;
  entity: string;
  itemCount: number;
  screenKey: string;
  source: string;
  status: string;
}) {
  logProjectionMetric({
    meta: {
      ageMs: params.ageMs,
      entity: params.entity,
      itemCount: params.itemCount,
      rate: 1,
      source: params.source,
      status: params.status,
    },
    name: "prefetch_hit_rate",
    screenKey: params.screenKey,
    status: "ok",
  });
}

export function logProjectionWarmupUsefulness(params: {
  ageMs: number;
  entity: string;
  itemCount: number;
  screenKey: string;
}) {
  logProjectionMetric({
    meta: {
      ageMs: params.ageMs,
      entity: params.entity,
      itemCount: params.itemCount,
      rate: 1,
    },
    name: "warmup_usefulness_rate",
    screenKey: params.screenKey,
    status: "ok",
  });
}

export function logProjectionDuplicateRequest(params: {
  entity: string;
  reason: string;
  screenKey: string;
}) {
  logProjectionMetric({
    meta: {
      entity: params.entity,
      reason: params.reason,
    },
    name: "duplicate_request_count",
    screenKey: params.screenKey,
    status: "ok",
  });
}

export function logProjectionFirstVisible(params: {
  durationMs: number;
  entity: string;
  itemCount: number;
  screenKey: string;
}) {
  logScreenView({
    durationMs: params.durationMs,
    meta: { entity: params.entity, itemCount: params.itemCount },
    name: `${params.entity}:first-visible`,
    screenKey: params.screenKey,
    status: "ok",
  });
}

export function logProjectionFirstCachedContent(params: {
  durationMs: number;
  entity: string;
  itemCount: number;
  screenKey: string;
}) {
  logScreenView({
    durationMs: params.durationMs,
    meta: { entity: params.entity, itemCount: params.itemCount },
    name: "time_to_first_cached_content",
    screenKey: params.screenKey,
    status: "ok",
  });
}

export function logProjectionSkippedFirstNetworkPatch(params: {
  entity: string;
  screenKey: string;
}) {
  logScreenView({
    durationMs: 0,
    meta: {
      entity: params.entity,
      hadCache: true,
      reason: "cache-satisfied-before-network",
    },
    name: "time_to_first_network_patch",
    screenKey: params.screenKey,
    status: "skipped",
  });
}

export function logProjectionTimeToInteractive(params: {
  durationMs: number;
  entity: string;
  hadCache: boolean;
  itemCount: number;
  screenKey: string;
  status: "error" | "ok";
}) {
  logScreenView({
    durationMs: params.durationMs,
    meta: {
      entity: params.entity,
      hadCache: params.hadCache,
      itemCount: params.itemCount,
    },
    name: "time_to_interactive",
    screenKey: params.screenKey,
    status: params.status,
  });
}

export function logProjectionFirstNetworkPatch(params: {
  durationMs: number;
  entity: string;
  mode: string;
  payloadSize: number;
  screenKey: string;
}) {
  logScreenView({
    durationMs: params.durationMs,
    meta: {
      entity: params.entity,
      mode: params.mode,
      payloadSize: params.payloadSize,
    },
    name: "time_to_first_network_patch",
    screenKey: params.screenKey,
    status: "ok",
  });
}

export function startProjectionLoadMoreTimer(params: { entity: string; screenKey: string }) {
  return startObservedTimer({
    category: "projection",
    meta: { entity: params.entity, mode: "append" },
    name: `${params.entity}:load-more`,
    screenKey: params.screenKey,
  });
}
