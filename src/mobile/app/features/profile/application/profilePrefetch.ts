import { useEffect, useMemo, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { debugWarn } from "../../../platform/logging/logger";
import {
  useViewportPrefetch,
  type ViewportPrefetchTarget,
} from "../../../data/projections/prefetch/useViewportPrefetch";
import type { AlbumPhotoWithMeta, EventWithMeta } from "../../../data/contracts/content";
import { prefetchProfileNextStepExperience } from "../../../data/projections/prefetch/nextStepPrefetch";
import { resolveNetworkBudget } from "../../../data/projections/networkAwareBudget";
import { usePriorityImagePrefetch } from "../../../data/projections/prefetch/usePriorityImagePrefetch";
import { scheduleAfterInteractions } from "../../../shared/utils/scheduleAfterInteractions";
import type { ProfileTab } from "../domain/profileConstants";

function normalizeValue(value: string | undefined | null) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function useProfileViewportPrefetch(params: {
  disabled?: boolean;
  scopeKey: string;
  tab: ProfileTab;
  viewerKey: string;
  viewerUserId?: string;
  viewerUsername: string;
}) {
  const resolvePrefetchTargets = useMemo(() => {
    const currentTab = params.tab;
    return (item: { clubUsername?: string; eventId?: string; id?: string; username?: string }) => {
      const targets: ViewportPrefetchTarget[] = [];
      if (currentTab === "events") {
        const clubUsername = normalizeValue(item.clubUsername);
        if (clubUsername) targets.push({ type: "profile", username: clubUsername });
      }
      return targets;
    };
  }, [params.tab]);

  return useViewportPrefetch({
    disabled: params.disabled,
    resolvePrefetchTargets,
    scopeKey: params.scopeKey,
    tier: "tier2",
    viewerKey: params.viewerKey,
    viewerUserId: params.viewerUserId,
    viewerUsername: params.viewerUsername,
  });
}

export function useProfileExperiencePrefetch(params: {
  albums: AlbumPhotoWithMeta[];
  disabled: boolean;
  events: EventWithMeta[];
  imageScopeKey: string;
  queryClient: QueryClient;
  screenKey: string;
  tab: ProfileTab;
  viewerId?: string;
  viewerKey: string;
  viewerUsername: string;
}) {
  const prefetchedTargetsRef = useRef(new Set<string>());
  const prefetchedImageUrisRef = useRef(new Set<string>());
  const prefetchAlbums = useMemo(() => params.albums.slice(0, 2), [params.albums]);
  const prefetchEvents = useMemo(() => params.events.slice(0, 2), [params.events]);
  const prefetchSeed = useMemo(
    () =>
      [
        ...prefetchEvents.map((item) => `event:${item.id}`),
        ...prefetchAlbums.map((item) => `album:${item.id}`),
      ].join("|"),
    [prefetchAlbums, prefetchEvents],
  );

  usePriorityImagePrefetch({
    disabled: params.disabled,
    items: (params.tab === "album" ? params.albums : params.events) as unknown[],
    scopeKey: params.imageScopeKey,
    tier: "tier2",
  });

  useEffect(() => {
    prefetchedTargetsRef.current.clear();
    prefetchedImageUrisRef.current.clear();
  }, [params.screenKey]);

  useEffect(() => {
    if (params.disabled || !prefetchSeed) return;
    const networkBudget = resolveNetworkBudget();
    if (!networkBudget.allowIntentPrefetch && !networkBudget.allowImagePrefetch) return;
    const task = scheduleAfterInteractions(() => {
      void prefetchProfileNextStepExperience({
        albums: prefetchAlbums,
        eventPrefetchMode: params.tab === "album" ? "album" : "detail",
        events: prefetchEvents,
        maxImages: 1,
        maxTargets: 2,
        prefetchedImageUris: prefetchedImageUrisRef.current,
        prefetchedTargets: prefetchedTargetsRef.current,
        queryClient: params.queryClient,
        screenKey: params.screenKey,
        source: "warmup",
        viewerId: params.viewerId,
        viewerKey: params.viewerKey,
        viewerUsername: params.viewerUsername,
      }).catch((error) => {
        debugWarn("PROFILE/PREFETCH", "profile-next-step-prefetch-failed", {
          message: String(
            (error as { message?: string } | null)?.message || "profile-next-step-prefetch-failed",
          ),
          screenKey: params.screenKey,
          viewerKey: params.viewerKey,
        });
      });
    }, 180);
    return () => task.cancel();
  }, [
    params.disabled,
    params.queryClient,
    params.screenKey,
    params.tab,
    params.viewerId,
    params.viewerKey,
    params.viewerUsername,
    prefetchAlbums,
    prefetchEvents,
    prefetchSeed,
  ]);
}
