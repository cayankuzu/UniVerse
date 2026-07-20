import { STARTUP_PERFORMANCE_BUDGET } from "./performanceBudget";
import type { HomeProjectionParams } from "./projections.types";

export const WARMUP_PROJECTION_RPC_TIMEOUT_MS = STARTUP_PERFORMANCE_BUDGET.warmupRpcTimeoutMs;
export const WARMUP_RPC_TIMEOUT = Symbol("warmup-rpc-timeout");

export type WarmupBundleParams = {
  home?: {
    entityFilter?: HomeProjectionParams["entityFilter"];
    scope: string;
    sortOption?: HomeProjectionParams["sortOption"];
    sourceFilter?: HomeProjectionParams["sourceFilter"];
    typeFilter?: HomeProjectionParams["typeFilter"];
  } | null;
  viewerId?: string;
  viewerUsername: string;
};
