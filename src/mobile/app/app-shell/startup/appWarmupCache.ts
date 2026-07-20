import type { QueryClient } from "@tanstack/react-query";
import type { AppWarmupBundle } from "../../data/projections/projections.types";
import { applyProjectionEnvelope, projectionKeys } from "../../data/projections";
import { noteProjectionPrefetch } from "../../data/projections/prefetch/prefetchRegistry";

export const HOME_WARMUP_SCOPE = "all:all:all:newest";
export const NOTIFICATIONS_WARMUP_FILTER = "all";

export function getWarmupBundleSize(bundle: AppWarmupBundle) {
  return {
    homeItems: bundle.home.items.length,
    totalItems: bundle.home.items.length,
  };
}

export function seedWarmupBundleIntoCache(params: {
  bundle: AppWarmupBundle;
  queryClient: QueryClient;
  viewerKey: string;
}) {
  if (params.bundle.home.items.length > 0) {
    const homeKey = projectionKeys.home(
      params.viewerKey,
      params.bundle.homeScope || HOME_WARMUP_SCOPE,
    );
    applyProjectionEnvelope({
      entity: "home-feed",
      envelope: params.bundle.home,
      mode: "replace",
      queryClient: params.queryClient,
      screenKey: homeKey,
    });
    noteProjectionPrefetch({ queryKey: homeKey, source: "warmup", status: "network" });
  }

  // A timeout bundle contains placeholder zero and must never erase a known badge.
  if (params.bundle.source === "rpc") {
    params.queryClient.setQueryData(
      projectionKeys.notificationBadge(params.viewerKey),
      params.bundle.notificationBadge,
    );
  }
}
