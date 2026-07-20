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
  stopTelemetry: ReturnType<typeof startObservedTimer>;
  viewerKey: string;
  warmupStartedAt: number;
}) {
  seedWarmupBundleIntoCache({
    bundle: params.bundle,
    queryClient: params.queryClient,
    viewerKey: params.viewerKey,
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
  params.stopTelemetry("ok", { ...bundleSize, source: params.bundle.source });

  const idleTask = scheduleAfterInteractions(() => {
    void params.runIdleWarmup(params.bundle).catch((error) => {
      params.reportWarmupFailure("idle", error);
    });
  }, 700);

  logScreenView({
    durationMs: Math.max(0, Date.now() - params.warmupStartedAt),
    meta: { reason: params.reason, source: params.bundle.source },
    name: params.reason === "foreground-stale" ? "foreground_sync_latency" : "warmup:startup",
    screenKey: params.viewerKey,
    status: "ok",
  });

  return { cancelIdleTask: () => idleTask.cancel(), warmedAt: Date.now() };
}

export async function seedAppWarmupBundle(
  params: SeedWarmupBundleParams & { reason: WarmupReason },
) {
  const warmupStartedAt = Date.now();
  const stopTelemetry = startObservedTimer({
    category: "screen",
    meta: { manifest: WARMUP_MANIFEST, reason: params.reason },
    name: "app-warmup",
    screenKey: params.viewerKey,
  });

  try {
    const cache = await prepareWarmupSeedCache({
      prefetchedImageUris: params.prefetchedImageUris,
      queryClient: params.queryClient,
      reason: params.reason,
      viewerKey: params.viewerKey,
    });

    if (!cache.shouldRequestWarmup) {
      stopTelemetry("skipped", { reason: "cache-or-screen-query-active" });
      return { cancelIdleTask: null, warmedAt: Date.now() };
    }

    const bundle = await getProjectionWarmupBundle({
      home: cache.preferences.lastHomeScope,
      viewerId: params.viewerId,
      viewerUsername: params.viewerUsername,
    });

    return finalizeWarmupSeed({
      bundle,
      queryClient: params.queryClient,
      reason: params.reason,
      reportWarmupFailure: params.reportWarmupFailure,
      runIdleWarmup: params.runIdleWarmup,
      stopTelemetry,
      viewerKey: params.viewerKey,
      warmupStartedAt,
    });
  } catch (error) {
    stopTelemetry("error", {
      message: String((error as { message?: string })?.message || error || ""),
    });
    throw error;
  }
}
