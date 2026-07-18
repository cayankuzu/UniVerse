import { useCallback, useEffect, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { prefetchNotificationsLandingExperience } from "../../../data/notifications";
import { useNextPageImagePrefetch } from "../../../data/projections/prefetch/useNextPageImagePrefetch";
import { prefetchHomeNextStepExperience } from "../../../data/projections/prefetch/nextStepPrefetch";
import { usePriorityImagePrefetch } from "../../../data/projections/prefetch/usePriorityImagePrefetch";
import { useViewportPrefetch } from "../../../data/projections/prefetch/useViewportPrefetch";
import type { AuthUserData } from "../../../data/contracts/entities";
import { debugWarn } from "../../../platform/logging/logger";
import { scheduleAfterInteractions } from "../../../shared/utils/scheduleAfterInteractions";
import type { HomeFeedItem } from "../data";
import type { HomeViewerData } from "./homeScreen.types";

type UseHomeScreenPrefetchParams = {
  collections: {
    effectiveItems: HomeFeedItem[];
    nextPageImageItems: unknown[];
  };
  filterScope: string;
  queryClient: QueryClient;
  suspendPrefetch: boolean;
  userData: AuthUserData;
  viewer: HomeViewerData;
  viewerKey: string;
};

function normalizePrefetchValue(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function useHomeScreenPrefetch(params: UseHomeScreenPrefetchParams) {
  const prefetchedHomeIntentTargetsRef = useRef(new Set<string>());
  const prefetchedHomeIntentImageUrisRef = useRef(new Set<string>());
  const viewportPrefetch = useViewportPrefetch<HomeFeedItem>({
    disabled: params.suspendPrefetch,
    resolvePrefetchTargets: (item) => {
      const eventId = normalizePrefetchValue(
        item.kind === "event" ? item.event.id || "" : item.album.eventId || "",
      );
      const clubUsername = normalizePrefetchValue(
        item.kind === "event" ? item.event.clubUsername || "" : item.album.clubUsername || "",
      );
      const targets: Array<{ type: "event"; id: string } | { type: "profile"; username: string }> =
        [];
      if (eventId) {
        targets.push({ type: "event", id: eventId });
      }
      if (clubUsername) {
        targets.push({ type: "profile", username: clubUsername });
      }
      return targets;
    },
    scopeKey: params.filterScope,
    tier: "tier2",
    waitForInteraction: false,
    viewerKey: params.viewerKey,
    viewerUserId: params.userData.id,
    viewerUsername: params.userData.username,
  });

  usePriorityImagePrefetch({
    disabled: params.suspendPrefetch,
    items: params.collections.nextPageImageItems,
    maxImages: 1,
    scopeKey: `${params.filterScope}:top-fold`,
    tier: "tier3",
  });

  useNextPageImagePrefetch({
    disabled: params.suspendPrefetch,
    items: params.collections.nextPageImageItems,
    screenKey: `home:${params.viewerKey}:${params.filterScope}`,
    tier: "tier3",
  });

  useEffect(() => {
    if (params.suspendPrefetch || params.collections.effectiveItems.length === 0) {
      return;
    }
    const task = scheduleAfterInteractions(() => {
      void prefetchHomeNextStepExperience({
        eventPrefetchMode: "detail",
        items: params.collections.effectiveItems,
        maxImages: 1,
        maxTargets: 2,
        prefetchedImageUris: prefetchedHomeIntentImageUrisRef.current,
        prefetchedTargets: prefetchedHomeIntentTargetsRef.current,
        queryClient: params.queryClient,
        source: "warmup",
        viewerId: params.userData.id,
        viewerKey: params.viewerKey,
        viewerUsername: params.userData.username,
      }).catch((error) => {
        debugWarn("HOME/PREFETCH", "home-next-step-prefetch-failed", {
          filterScope: params.filterScope,
          message: String(
            (error as { message?: string } | null)?.message || "home-next-step-prefetch-failed",
          ),
          viewerKey: params.viewerKey,
        });
      });
    }, 180);
    return () => task.cancel();
  }, [
    params.collections.effectiveItems,
    params.filterScope,
    params.queryClient,
    params.suspendPrefetch,
    params.userData.id,
    params.userData.username,
    params.viewerKey,
  ]);

  const onNotificationsPressIn = useCallback(() => {
    if (!params.userData.username) return;
    void prefetchNotificationsLandingExperience({
      queryClient: params.queryClient,
      source: "intent",
      viewer: params.viewer,
    });
  }, [params.queryClient, params.userData.username, params.viewer]);

  return {
    onNotificationsPressIn,
    onViewableItemsChanged: viewportPrefetch.onViewableItemsChanged,
    viewabilityConfig: viewportPrefetch.viewabilityConfig,
  };
}
