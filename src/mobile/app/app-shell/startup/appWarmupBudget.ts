import type { AppStateStatus } from "react-native";
import type { AppWarmupBundle } from "../../data/projections/projections.types";
import { resolveNetworkBudget } from "../../data/projections/networkAwareBudget";
import { STARTUP_PERFORMANCE_BUDGET } from "../../data/projections/performanceBudget";

export type WarmupIdleBudget = {
  allowIdle: boolean;
  maxImages: number;
};

const DISABLED_BUDGET: WarmupIdleBudget = {
  allowIdle: false,
  maxImages: 0,
};

export function resolveWarmupIdleBudget(params: {
  appState: AppStateStatus;
  bundle: AppWarmupBundle;
}) {
  if (params.appState !== "active") return DISABLED_BUDGET;
  if (params.bundle.source === "timeout-backpressure") return DISABLED_BUDGET;

  const networkBudget = resolveNetworkBudget(params.appState);

  if (networkBudget.quality === "offline") return DISABLED_BUDGET;
  const constrainedBudget =
    params.bundle.source === "fallback" || networkBudget.quality === "degraded";
  const maxImages = networkBudget.allowImagePrefetch
    ? constrainedBudget
      ? Math.min(1, STARTUP_PERFORMANCE_BUDGET.idleImages)
      : STARTUP_PERFORMANCE_BUDGET.idleImages
    : 0;
  return {
    allowIdle: maxImages > 0,
    maxImages,
  };
}
