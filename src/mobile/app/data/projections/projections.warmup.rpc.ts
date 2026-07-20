import { isFunctionUnavailable } from "../../platform/api/core";
import { debugLog } from "../../platform/logging/logger";
import { normalizeProjectionValue } from "./projections.common";
import type { AppWarmupBundle } from "./projections.types";
import {
  createBackpressureWarmupBundle,
  HOME_WARMUP_SCOPE,
  normalizeWarmupBundle,
} from "./projections.warmup.normalize";
import {
  type WarmupBundleParams,
  WARMUP_PROJECTION_RPC_TIMEOUT_MS,
} from "./projections.warmup.contracts";
import { buildWarmupRpcParams, executeWarmupProjectionRpc } from "./projections.warmup.transport";

export async function getProjectionWarmupBundle(
  params: WarmupBundleParams,
): Promise<AppWarmupBundle> {
  const normalizedViewerUsername = normalizeProjectionValue(params.viewerUsername || "");
  const preferredHomeScope =
    String(params.home?.scope || HOME_WARMUP_SCOPE).trim() || HOME_WARMUP_SCOPE;
  const { data, error, timedOut } = await executeWarmupProjectionRpc(
    buildWarmupRpcParams({ normalizedViewerUsername, request: params }),
  );

  if (!error) {
    const bundle = normalizeWarmupBundle(data);
    if (bundle) return { ...bundle, homeScope: preferredHomeScope };
  } else if (!isFunctionUnavailable(error)) {
    debugLog("PROJECTIONS", timedOut ? "warmup-rpc-timeout" : "warmup-rpc-skipped", {
      fn: "app_warmup_projection",
      message: error.message,
      timeoutMs: timedOut ? WARMUP_PROJECTION_RPC_TIMEOUT_MS : undefined,
    });
  }

  // Screens remain responsible for their own projection query. Starting another
  // fallback fan-out here would duplicate that work and make slow networks worse.
  return createBackpressureWarmupBundle(preferredHomeScope);
}
