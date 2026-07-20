import type { QueryClient } from "@tanstack/react-query";
import type { ProjectionHomeFeedItem } from "../../data/projections/projections.types";

import {
  loadPersistedWarmupPreferences,
  type PersistedWarmupPreferences,
} from "../../data/projections/warmupPreferences";
import { STARTUP_PERFORMANCE_BUDGET } from "../../data/projections/performanceBudget";
import { getProjectionState, projectionKeys, readProjectionItems } from "../../data/projections";
import { logProjectionMetric } from "../../platform/observability";
import { preloadMediaSources } from "../../shared/media/preloadMediaSources";
import { HOME_WARMUP_SCOPE, NOTIFICATIONS_WARMUP_FILTER } from "./appWarmupCache";
import { takeFreshWarmupImageUris } from "./appWarmupHelpers";
import { WARMUP_MANIFEST, type WarmupReason } from "./appWarmup.shared";

export interface WarmupSeedCacheSnapshot {
  homeItems: ProjectionHomeFeedItem[];
  homeItemCount: number;
  preferences: PersistedWarmupPreferences;
  preferredHomeScope: string;
  shouldRequestWarmup: boolean;
}

interface PrepareWarmupSeedCacheParams {
  prefetchedImageUris: Set<string>;
  queryClient: QueryClient;
  reason: WarmupReason;
  viewerKey: string;
}

export async function prepareWarmupSeedCache(
  params: PrepareWarmupSeedCacheParams,
): Promise<WarmupSeedCacheSnapshot> {
  const preferences = await loadPersistedWarmupPreferences(params.viewerKey);
  const preferredHomeScope = preferences.lastHomeScope?.scope || HOME_WARMUP_SCOPE;
  const homeKey = projectionKeys.home(params.viewerKey, preferredHomeScope);
  const notificationsKey = projectionKeys.notifications(
    params.viewerKey,
    NOTIFICATIONS_WARMUP_FILTER,
  );
  const homeItems = readProjectionItems<ProjectionHomeFeedItem>(
    params.queryClient,
    homeKey,
    "home-feed",
  );
  const homeState = getProjectionState(params.queryClient, homeKey);
  const homeQueryState = params.queryClient.getQueryState(homeKey);
  const notificationItemCount = readProjectionItems(
    params.queryClient,
    notificationsKey,
    "notifications",
  ).length;
  const criticalEntries = [
    Boolean(homeState) && ((homeState?.ids?.length || 0) === 0 || homeItems.length > 0),
    params.queryClient.getQueryState(projectionKeys.notificationBadge(params.viewerKey))?.status ===
      "success",
  ];
  const cacheHits = criticalEntries.filter(Boolean).length;

  logProjectionMetric({
    meta: {
      homeItems: homeItems.length,
      manifest: WARMUP_MANIFEST.critical,
      notificationItems: notificationItemCount,
      rate: criticalEntries.length > 0 ? cacheHits / criticalEntries.length : 0,
      reason: params.reason,
      total: criticalEntries.length,
      warmCacheHits: cacheHits,
    },
    name: "warmup_hit_rate",
    screenKey: params.viewerKey,
    status: cacheHits > 0 ? "ok" : "skipped",
  });

  if (homeItems.length > 0) {
    warmCachedHomeImages({
      homeItems,
      prefetchedImageUris: params.prefetchedImageUris,
      viewerKey: params.viewerKey,
    });
  }

  return {
    homeItems,
    homeItemCount: homeItems.length,
    preferences,
    preferredHomeScope,
    shouldRequestWarmup:
      homeQueryState?.fetchStatus !== "fetching" && (!homeState || homeState.isStale === true),
  };
}

function warmCachedHomeImages(params: {
  homeItems: unknown[];
  prefetchedImageUris: Set<string>;
  viewerKey: string;
}) {
  const earlyImageUris = takeFreshWarmupImageUris(
    params.homeItems.slice(0, STARTUP_PERFORMANCE_BUDGET.cachePreviewItems),
    params.prefetchedImageUris,
    STARTUP_PERFORMANCE_BUDGET.cachePreviewImages,
  );

  logProjectionMetric({
    meta: {
      cachedItems: params.homeItems.length,
      extractedUris: earlyImageUris.length,
      phase: "early-cache",
    },
    name: "image_prefetch_pipeline",
    screenKey: params.viewerKey,
    status: earlyImageUris.length > 0 ? "ok" : "skipped",
  });

  if (earlyImageUris.length === 0) return;

  void preloadMediaSources(earlyImageUris, {
    allowNetworkResolve: true,
    batchSize: STARTUP_PERFORMANCE_BUDGET.cachePreviewImages,
    priority: "eager",
  }).then((resolvedCount) => {
    logProjectionMetric({
      meta: {
        phase: "early-cache",
        requested: earlyImageUris.length,
        resolved: resolvedCount,
      },
      name: "image_prefetch_pipeline",
      screenKey: params.viewerKey,
      status: resolvedCount > 0 ? "ok" : "skipped",
    });
  });
}
