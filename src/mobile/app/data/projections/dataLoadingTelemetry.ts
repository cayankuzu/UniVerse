/**
 * Data loading observability — tracks request waterfalls, network budget
 * skips, and image prefetch effectiveness.
 */
import { logProjectionMetric } from "../../platform/observability";

// ─── Request Waterfall Detection ─────────────────────────────────────────────

const WATERFALL_WINDOW_MS = 400;
const screenRequestTimestamps = new Map<string, number[]>();

/**
 * Record a request for a screen key and detect waterfalls.
 * A "waterfall" is 3+ sequential requests within WATERFALL_WINDOW_MS for the
 * same screen, suggesting they could have been parallelised.
 */
export function trackScreenRequest(screenKey: string, requestLabel: string) {
  const now = Date.now();
  let timestamps = screenRequestTimestamps.get(screenKey);
  if (!timestamps) {
    timestamps = [];
    screenRequestTimestamps.set(screenKey, timestamps);
  }
  // Purge timestamps outside the window
  const cutoff = now - WATERFALL_WINDOW_MS;
  while (timestamps.length > 0 && timestamps[0]! < cutoff) {
    timestamps.shift();
  }
  timestamps.push(now);

  if (timestamps.length >= 3) {
    logProjectionMetric({
      meta: {
        chainLength: timestamps.length,
        requestLabel,
        windowMs: WATERFALL_WINDOW_MS,
      },
      name: "request_waterfall_detected",
      screenKey,
      status: "ok",
    });
  }
}

/**
 * Clear waterfall tracking for a screen (e.g., on unmount).
 */
export function clearScreenRequestTracking(screenKey: string) {
  screenRequestTimestamps.delete(screenKey);
}

// ─── Network Budget Skip Tracking ────────────────────────────────────────────

export function logNetworkBudgetSkip(params: {
  action: "idle-prefetch" | "image-prefetch" | "intent-prefetch" | "viewport-prefetch";
  quality: string;
  screenKey: string;
}) {
  logProjectionMetric({
    meta: {
      action: params.action,
      quality: params.quality,
    },
    name: "network_budget_skip",
    screenKey: params.screenKey,
    status: "skipped",
  });
}

// ─── Image Prefetch Effectiveness ────────────────────────────────────────────

export function logNextPageImagePrefetch(params: {
  newItemCount: number;
  prefetchedCount: number;
  screenKey: string;
  skippedCount: number;
}) {
  logProjectionMetric({
    meta: {
      newItemCount: params.newItemCount,
      prefetchedCount: params.prefetchedCount,
      skippedCount: params.skippedCount,
    },
    name: "next_page_image_prefetch",
    screenKey: params.screenKey,
    status: params.prefetchedCount > 0 ? "ok" : "skipped",
  });
}

export function logViewportPrefetchFired(params: {
  screenKey: string;
  targetCount: number;
  targetType: "event" | "profile";
}) {
  logProjectionMetric({
    meta: {
      targetCount: params.targetCount,
      targetType: params.targetType,
    },
    name: "viewport_prefetch_fired",
    screenKey: params.screenKey,
    status: "ok",
  });
}

export function logPerformanceBudgetTrim(params: {
  applied: number;
  budget: string;
  requested: number;
  screenKey: string;
}) {
  logProjectionMetric({
    meta: {
      applied: params.applied,
      budget: params.budget,
      requested: params.requested,
    },
    name: "performance_budget_trim",
    screenKey: params.screenKey,
    status: params.applied < params.requested ? "ok" : "skipped",
  });
}
