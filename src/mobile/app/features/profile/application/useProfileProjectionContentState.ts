import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AlbumPhotoWithMeta, EventWithMeta } from "../../../data/contracts/content";
import { PAGE_SIZES } from "../../../data/projections/cacheConfig";
import type { ProfileContentTab } from "../../../data/projections/projections.types";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import {
  applyProjectionEnvelope,
  getProjectionState,
  readProjectionItems,
} from "../../../data/projections/projections";
import { prefetchProjectionScreen } from "../../../data/projections/prefetch/prefetchProjection";
import { replaceProjectionScope } from "../../../data/projections/projectionRefresh";
import { resolveNetworkBudget } from "../../../data/projections/networkAwareBudget";
import { debugWarn } from "../../../platform/logging/logger";
import { fetchViewProfileContent } from "../data";
import {
  sanitizeProfileAlbums,
  sanitizeProfileEvents,
  getProfileContentEntity,
  getProfileProjectionPrefetchTabs,
} from "./profileCollections";

type Params = {
  activeItems: Array<AlbumPhotoWithMeta | EventWithMeta>;
  enabled: boolean;
  expectedAlbumsCount?: number;
  expectedEventsCount?: number;
  tab: ProfileContentTab;
  username: string;
  viewerId?: string;
  viewerKey: string;
  viewerUsername?: string;
};

const PROFILE_PREFETCH_STABILITY_MS = 220;
const PROFILE_PREFETCH_PAGE_SIZE = PAGE_SIZES.profileContent;
const EMPTY_PROFILE_CONTENT: never[] = [];

export function useProfileProjectionContentState({
  activeItems,
  enabled,
  expectedAlbumsCount = 0,
  expectedEventsCount = 0,
  tab,
  username,
  viewerId,
  viewerKey,
  viewerUsername,
}: Params) {
  const queryClient = useQueryClient();
  const inflightPrefetchesRef = useRef(new Set<string>());
  const invalidProjectionRepairRef = useRef(new Map<string, "hydrate" | "replace">());
  const albumContentKey = useMemo(
    () => projectionKeys.profileContent(username, "album", viewerKey),
    [username, viewerKey],
  );
  const eventContentKey = useMemo(
    () => projectionKeys.profileContent(username, "events", viewerKey),
    [username, viewerKey],
  );

  useQuery({
    enabled: false,
    initialData: () => getProjectionState(queryClient, albumContentKey),
    queryFn: async () => getProjectionState(queryClient, albumContentKey),
    queryKey: albumContentKey,
    staleTime: Number.POSITIVE_INFINITY,
  });
  useQuery({
    enabled: false,
    initialData: () => getProjectionState(queryClient, eventContentKey),
    queryFn: async () => getProjectionState(queryClient, eventContentKey),
    queryKey: eventContentKey,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const cachedAlbums = readProjectionItems<AlbumPhotoWithMeta>(
    queryClient,
    albumContentKey,
    "profile-albums",
  );
  const cachedEvents = readProjectionItems<EventWithMeta>(
    queryClient,
    eventContentKey,
    "profile-events",
  );
  const activeAlbumItems = useMemo(
    () => (tab === "album" ? (activeItems as AlbumPhotoWithMeta[]) : []),
    [activeItems, tab],
  );
  const activeEventItems = useMemo(
    () => (tab === "events" ? (activeItems as EventWithMeta[]) : []),
    [activeItems, tab],
  );
  const validCachedAlbums = useMemo(() => sanitizeProfileAlbums(cachedAlbums), [cachedAlbums]);
  const validCachedEvents = useMemo(() => sanitizeProfileEvents(cachedEvents), [cachedEvents]);
  const validActiveAlbumItems = useMemo(
    () => sanitizeProfileAlbums(activeAlbumItems),
    [activeAlbumItems],
  );
  const validActiveEventItems = useMemo(
    () => sanitizeProfileEvents(activeEventItems),
    [activeEventItems],
  );

  const prefetchTabs = useMemo(
    () =>
      getProfileProjectionPrefetchTabs({
        activeTab: tab,
        albumsCount: expectedAlbumsCount,
        eventsCount: expectedEventsCount,
      }),
    [expectedAlbumsCount, expectedEventsCount, tab],
  );

  useEffect(() => {
    if (!enabled || !username || prefetchTabs.length === 0) return;
    const timer = setTimeout(() => {
      const networkBudget = resolveNetworkBudget();
      if (!networkBudget.allowIntentPrefetch) return;
      prefetchTabs.forEach((nextTab) => {
        const contentKey = nextTab === "album" ? albumContentKey : eventContentKey;
        const requestKey = JSON.stringify(contentKey);
        if (
          inflightPrefetchesRef.current.has(requestKey) ||
          getProjectionState(queryClient, contentKey)
        ) {
          return;
        }

        inflightPrefetchesRef.current.add(requestKey);
        void prefetchProjectionScreen({
          entity: getProfileContentEntity(nextTab),
          fetchProjection: () =>
            fetchViewProfileContent({
              context: { limit: PROFILE_PREFETCH_PAGE_SIZE },
              tab: nextTab,
              username,
              viewerId,
              viewerUsername,
            }),
          queryClient,
          queryKey: contentKey,
          staleTime: 15_000,
        })
          .catch((error) => {
            debugWarn("PROFILE/PREFETCH", "profile-tab-prefetch-failed", {
              message: String(
                (error as { message?: string } | null)?.message || "profile-tab-prefetch-failed",
              ),
              requestKey,
              username,
            });
          })
          .finally(() => {
            inflightPrefetchesRef.current.delete(requestKey);
          });
      });
    }, PROFILE_PREFETCH_STABILITY_MS);

    return () => clearTimeout(timer);
  }, [
    albumContentKey,
    enabled,
    eventContentKey,
    prefetchTabs,
    queryClient,
    username,
    viewerId,
    viewerUsername,
  ]);

  useEffect(() => {
    const hydrateProjectionNow = async (
      contentKey: readonly unknown[],
      nextTab: ProfileContentTab,
    ) => {
      const envelope = await fetchViewProfileContent({
        context: { limit: PROFILE_PREFETCH_PAGE_SIZE },
        tab: nextTab,
        username,
        viewerId,
        viewerUsername,
      });
      return applyProjectionEnvelope({
        entity: getProfileContentEntity(nextTab),
        envelope,
        mode: "replace",
        queryClient,
        screenKey: contentKey,
      });
    };

    const repairInvalidProjection = (params: {
      contentKey: readonly unknown[];
      expectedCount: number;
      rawItems: unknown[];
      validItems: unknown[];
      label: "album" | "events";
    }) => {
      if (!enabled) return;
      const repairKey = JSON.stringify(params.contentKey);
      if (params.expectedCount <= 0) {
        invalidProjectionRepairRef.current.delete(repairKey);
        return;
      }
      const hasEmptyProjectionMismatch =
        params.rawItems.length === 0 && params.validItems.length === 0;
      const hasInvalidProjectionShape =
        params.rawItems.length > 0 && params.validItems.length === 0;
      if (!hasEmptyProjectionMismatch && !hasInvalidProjectionShape) {
        invalidProjectionRepairRef.current.delete(repairKey);
        return;
      }
      const repairMode = hasEmptyProjectionMismatch && params.label === tab ? "hydrate" : "replace";
      const currentRepairMode = invalidProjectionRepairRef.current.get(repairKey);
      if (currentRepairMode === "hydrate") return;
      if (currentRepairMode === "replace" && repairMode === "replace") return;
      invalidProjectionRepairRef.current.set(repairKey, repairMode);
      debugWarn("PROFILE/PREFETCH", "profile-content-repair-scheduled", {
        expectedCount: params.expectedCount,
        label: params.label,
        repairMode,
        rawItemCount: params.rawItems.length,
        validItemCount: params.validItems.length,
        username,
      });
      if (repairMode === "hydrate") {
        void hydrateProjectionNow(params.contentKey, params.label)
          .then(() => {
            invalidProjectionRepairRef.current.delete(repairKey);
          })
          .catch((error) => {
            invalidProjectionRepairRef.current.set(repairKey, "replace");
            debugWarn("PROFILE/PREFETCH", "profile-content-repair-failed", {
              label: params.label,
              message: String(
                (error as { message?: string } | null)?.message || "profile-content-repair-failed",
              ),
              username,
            });
            replaceProjectionScope(queryClient, params.contentKey);
          });
        return;
      }
      replaceProjectionScope(queryClient, params.contentKey);
    };

    repairInvalidProjection({
      contentKey: albumContentKey,
      expectedCount: expectedAlbumsCount,
      label: "album",
      rawItems: activeAlbumItems.length > 0 ? activeAlbumItems : cachedAlbums,
      validItems: activeAlbumItems.length > 0 ? validActiveAlbumItems : validCachedAlbums,
    });
    repairInvalidProjection({
      contentKey: eventContentKey,
      expectedCount: expectedEventsCount,
      label: "events",
      rawItems: activeEventItems.length > 0 ? activeEventItems : cachedEvents,
      validItems: activeEventItems.length > 0 ? validActiveEventItems : validCachedEvents,
    });
  }, [
    activeAlbumItems,
    activeEventItems,
    albumContentKey,
    cachedAlbums,
    cachedEvents,
    enabled,
    eventContentKey,
    expectedAlbumsCount,
    expectedEventsCount,
    queryClient,
    tab,
    validActiveAlbumItems,
    validActiveEventItems,
    validCachedAlbums,
    validCachedEvents,
    viewerId,
    viewerUsername,
    username,
  ]);

  const sourceAlbums = useMemo(
    () =>
      !enabled
        ? EMPTY_PROFILE_CONTENT
        : tab === "album"
          ? validActiveAlbumItems.length > 0
            ? validActiveAlbumItems
            : validCachedAlbums
          : validCachedAlbums,
    [enabled, tab, validActiveAlbumItems, validCachedAlbums],
  );
  const sourceEvents = useMemo(
    () =>
      !enabled
        ? EMPTY_PROFILE_CONTENT
        : tab === "events"
          ? validActiveEventItems.length > 0
            ? validActiveEventItems
            : validCachedEvents
          : validCachedEvents,
    [enabled, tab, validActiveEventItems, validCachedEvents],
  );

  return {
    sourceAlbums,
    sourceEvents,
  };
}
