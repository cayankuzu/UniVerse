import { STARTUP_PERFORMANCE_BUDGET } from "../../data/projections/performanceBudget";
import type { AccountType } from "../../data/contracts/api";
import type { QueryClient } from "@tanstack/react-query";

// Re-warm often enough to keep tier-1 surfaces fresh after backgrounding.
export const WARMUP_STALE_MS = STARTUP_PERFORMANCE_BUDGET.warmupStaleMs;

export const WARMUP_MANIFEST = {
  critical: ["home"] as const,
  idle: ["images"] as const,
};

export type WarmupSharedParams = {
  accountType: AccountType;
  queryClient: QueryClient;
  viewerId?: string;
  viewerKey: string;
  viewerUsername: string;
};

export type WarmupReason = "foreground-stale" | "startup";
export type WarmupFailurePhase = WarmupReason | "idle";
