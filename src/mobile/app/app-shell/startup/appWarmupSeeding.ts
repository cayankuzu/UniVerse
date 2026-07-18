import { getHomeFeed } from "../../features/home/public/queries";
import {
  getNotificationBadge,
  getNotifications,
} from "../../features/notifications/public/queries";
import { getProfileContent, getProfileOverview } from "../../features/profile/public/queries";
import { getSearchResults } from "../../features/search/public/queries";
import { getViewerRelationshipSnapshot } from "../../data/social";
import type { AlbumPhotoWithMeta, EventWithMeta } from "../../data/contracts/content";
import type { ProjectionEnvelope } from "../../data/query/contracts";
import type { AppWarmupBundle } from "../../data/projections/projections.types";
import { getProjectionWarmupBundle } from "../../data/projections/projections.warmup";
import {
  logProjectionMetric,
  logScreenView,
  startObservedTimer,
} from "../../platform/observability";
import { scheduleAfterInteractions } from "../../shared/utils/scheduleAfterInteractions";
import { getWarmupBundleSize, seedWarmupBundleIntoCache } from "./appWarmupCache";
import { WARMUP_MANIFEST, type WarmupReason, type WarmupSharedParams } from "./appWarmup.shared";
import { prepareWarmupSeedCache } from "./appWarmupSeeding.cache";

type SeedWarmupBundleParams = WarmupSharedParams & {
  prefetchedImageUris: Set<string>;
  reportWarmupFailure: (phase: "idle", error: unknown) => void;
  runIdleWarmup: (bundle: AppWarmupBundle) => Promise<void>;
};

function finalizeWarmupSeed(params: {
  bundle: AppWarmupBundle;
  queryClient: SeedWarmupBundleParams["queryClient"];
  reason: WarmupReason;
  reportWarmupFailure: SeedWarmupBundleParams["reportWarmupFailure"];
  runIdleWarmup: SeedWarmupBundleParams["runIdleWarmup"];
  stopWarmupTelemetry: ReturnType<typeof startObservedTimer>;
  viewerKey: string;
  viewerUsername: string;
  warmupStartedAt: number;
}) {
  seedWarmupBundleIntoCache({
    bundle: params.bundle,
    queryClient: params.queryClient,
    viewerKey: params.viewerKey,
    viewerUsername: params.viewerUsername,
  });

  const bundleSize = getWarmupBundleSize(params.bundle);
  logProjectionMetric({
    meta: {
      ...bundleSize,
      manifest: WARMUP_MANIFEST.idle,
      reason: params.reason,
      source: params.bundle.source,
    },
    name: "startup_bundle_size",
    screenKey: params.viewerKey,
    status: "ok",
  });
  params.stopWarmupTelemetry("ok", {
    ...bundleSize,
    source: params.bundle.source,
  });

  const idleTask = scheduleAfterInteractions(() => {
    void params.runIdleWarmup(params.bundle).catch((error) => {
      params.reportWarmupFailure("idle", error);
    });
  }, 700);

  logScreenView({
    durationMs: Math.max(0, Date.now() - params.warmupStartedAt),
    meta: {
      idleScopes: WARMUP_MANIFEST.idle,
      reason: params.reason,
      source: params.bundle.source,
    },
    name: params.reason === "foreground-stale" ? "foreground_sync_latency" : "warmup:startup",
    screenKey: params.viewerKey,
    status: "ok",
  });
  logScreenView({
    meta: {
      idleScopes: WARMUP_MANIFEST.idle,
      phase: "f2-deferred-prefetch",
      reason: params.reason,
      source: params.bundle.source,
    },
    name: "startup_phase:deferred_prefetch_scheduled",
    screenKey: params.viewerKey,
    status: "ok",
  });

  return {
    cancelIdleTask: () => idleTask.cancel(),
    warmedAt: Date.now(),
  };
}

export async function seedAppWarmupBundle(
  params: SeedWarmupBundleParams & { reason: WarmupReason },
) {
  const warmupStartedAt = Date.now();
  const stopWarmupTelemetry = startObservedTimer({
    category: "screen",
    meta: {
      manifest: WARMUP_MANIFEST,
      reason: params.reason,
    },
    name: "app-warmup",
    screenKey: params.viewerKey,
  });

  try {
    const { preferences } = await prepareWarmupSeedCache({
      prefetchedImageUris: params.prefetchedImageUris,
      queryClient: params.queryClient,
      reason: params.reason,
      viewerKey: params.viewerKey,
    });

    const bundle = await getProjectionWarmupBundle(
      {
        home: preferences.lastHomeScope
          ? {
              entityFilter: preferences.lastHomeScope.entityFilter,
              scope: preferences.lastHomeScope.scope,
              sortOption: preferences.lastHomeScope.sortOption,
              sourceFilter: preferences.lastHomeScope.sourceFilter,
              typeFilter: preferences.lastHomeScope.typeFilter,
            }
          : null,
        search: preferences.lastSearchScope
          ? {
              categoryFilter: preferences.lastSearchScope.categoryFilter,
              feeFilter: preferences.lastSearchScope.feeFilter,
              kind: preferences.lastSearchScope.kind,
              queryText: preferences.lastSearchScope.queryText,
              scope: preferences.lastSearchScope.scope,
              sortMode: preferences.lastSearchScope.sortMode,
              universityFilter: preferences.lastSearchScope.universityFilter,
            }
          : null,
        skipHomeBadgeInFallback: false,
        viewerAccountType: params.accountType,
        viewerId: params.viewerId || undefined,
        viewerUsername: params.viewerUsername,
      },
      {
        getHomeFeed,
        getNotificationBadge,
        getNotifications,
        getProfileContent: getProfileContent as (
          username: string,
          tab: "album" | "events",
          viewerId?: string,
          context?: { limit?: number },
        ) => Promise<ProjectionEnvelope<AlbumPhotoWithMeta | EventWithMeta>>,
        getProfileOverview,
        getSearchResults,
        getViewerRelationshipSnapshot,
      },
    );

    return finalizeWarmupSeed({
      bundle,
      queryClient: params.queryClient,
      reason: params.reason,
      reportWarmupFailure: params.reportWarmupFailure,
      runIdleWarmup: params.runIdleWarmup,
      stopWarmupTelemetry,
      viewerKey: params.viewerKey,
      viewerUsername: params.viewerUsername,
      warmupStartedAt,
    });
  } catch (error) {
    stopWarmupTelemetry("error", {
      message: String((error as { message?: string })?.message || error || ""),
    });
    throw error;
  }
}
