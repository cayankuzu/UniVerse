import { isFunctionUnavailable } from "../../platform/api/core";
import { debugLog } from "../../platform/logging/logger";
import { normalizeProjectionValue } from "./projections.common";
import type { AppWarmupBundle } from "./projections.types";
import { HOME_WARMUP_SCOPE, normalizeWarmupBundle } from "./projections.warmup.normalize";
import {
  type WarmupBundleParams,
  type WarmupDelegates,
  WARMUP_PROJECTION_RPC_TIMEOUT_MS,
} from "./projections.warmup.contracts";
import { buildFallbackWarmupBundle } from "./projections.warmup.fallback";
import { buildWarmupRpcParams, executeWarmupProjectionRpc } from "./projections.warmup.transport";

export async function getProjectionWarmupBundle(
  params: WarmupBundleParams,
  delegates: WarmupDelegates,
): Promise<AppWarmupBundle> {
  const normalizedViewerUsername = normalizeProjectionValue(params.viewerUsername || "");
  const preferredHomeScope =
    String(params.home?.scope || HOME_WARMUP_SCOPE).trim() || HOME_WARMUP_SCOPE;
  const { data, error, timedOut } = await executeWarmupProjectionRpc(
    buildWarmupRpcParams({
      normalizedViewerUsername,
      request: params,
    }),
  );

  if (!error) {
    const bundle = normalizeWarmupBundle(data);
    if (bundle) return bundle;
  } else if (!isFunctionUnavailable(error)) {
    debugLog("PROJECTIONS", timedOut ? "warmup-rpc-timeout-fallback" : "warmup-rpc-fallback", {
      fn: "app_warmup_projection",
      message: error.message,
      timeoutMs: timedOut ? WARMUP_PROJECTION_RPC_TIMEOUT_MS : undefined,
    });
  }

  if (timedOut) {
    debugLog("PROJECTIONS", "warmup-fallback-after-timeout", {
      fn: "app_warmup_projection",
      reason: params.skipHomeBadgeInFallback ? "notifications-only" : "progressive-fallback",
      timeoutMs: WARMUP_PROJECTION_RPC_TIMEOUT_MS,
    });
  }

  return buildFallbackWarmupBundle({
    delegates,
    normalizedViewerUsername,
    preferredHomeScope,
    request: params,
  });
}
