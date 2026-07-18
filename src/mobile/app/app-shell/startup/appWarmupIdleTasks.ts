import type { MutableRefObject } from "react";
import type { AppStateStatus } from "react-native";
import type { AppWarmupBundle } from "../../data/projections/projections.types";
import { logScreenView, startObservedTimer } from "../../platform/observability";
import { resolveWarmupIdleBudget } from "./appWarmupBudget";
import { buildImagePrefetchTask } from "./appWarmupImages";

export type IdleWarmupParams = {
  appStateRef: MutableRefObject<AppStateStatus>;
  bundle: AppWarmupBundle;
  prefetchedImageUrisRef: MutableRefObject<Set<string>>;
  viewerKey: string;
};

function isWarmupAllowed(appState: AppStateStatus) {
  return appState === "active";
}

export async function runAppWarmupIdleTasks(params: IdleWarmupParams) {
  const budget = resolveWarmupIdleBudget({
    appState: params.appStateRef.current,
    bundle: params.bundle,
  });
  if (!budget.allowIdle) {
    logScreenView({
      meta: {
        phase: "f3-idle",
        reason: "budget-disabled",
        source: params.bundle.source,
      },
      name: "startup_phase:idle_warmup",
      screenKey: params.viewerKey,
      status: "skipped",
    });
    return;
  }

  const { imageUris, task } = buildImagePrefetchTask({
    bundle: params.bundle,
    maxImages: budget.maxImages,
    prefetchedImageUris: params.prefetchedImageUrisRef.current,
    viewerKey: params.viewerKey,
  });
  if (!task || imageUris.length === 0 || !isWarmupAllowed(params.appStateRef.current)) {
    return;
  }

  const stopTelemetry = startObservedTimer({
    category: "screen",
    meta: {
      phase: "f3-idle",
      source: params.bundle.source,
    },
    name: "startup_phase:idle_warmup",
    screenKey: params.viewerKey,
  });

  try {
    await task();
    stopTelemetry(isWarmupAllowed(params.appStateRef.current) ? "ok" : "rollback", {
      imageTaskCount: 1,
    });
  } catch (error) {
    stopTelemetry("rollback", {
      imageTaskCount: 1,
      message: String((error as { message?: string } | null)?.message || error || ""),
    });
  }
}
