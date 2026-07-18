import type { QueryClient } from "@tanstack/react-query";
import type {
  AppWarmupBundle,
  SearchProjectionParams,
} from "../../data/projections/projections.types";
import {
  applyProjectionEnvelope,
  projectionKeys,
  SEARCH_DISCOVERY_KINDS,
  SEARCH_DISCOVERY_SCOPE,
} from "../../data/projections";
import { noteProjectionPrefetch } from "../../data/projections/prefetch/prefetchRegistry";
import { debugLog } from "../../platform/logging/logger";

export const HOME_WARMUP_SCOPE = "all:all:all:newest";
export const NOTIFICATIONS_WARMUP_FILTER = "all";

export function resolveSearchProjectionEntity(kind: SearchProjectionParams["kind"]) {
  return kind === "events" ? "search-events" : kind === "albums" ? "search-albums" : "search-users";
}

export function getWarmupBundleSize(bundle: AppWarmupBundle) {
  const searchDiscoveryItems = SEARCH_DISCOVERY_KINDS.reduce(
    (total, kind) => total + (bundle.searchDiscovery[kind]?.items.length || 0),
    0,
  );
  const searchItems = bundle.search?.content.items.length || 0;
  return {
    homeItems: bundle.home.items.length,
    notificationItems: bundle.notifications.items.length,
    profileAlbumItems: bundle.profileAlbums.items.length,
    profileEventItems: bundle.profileEvents.items.length,
    searchDiscoveryItems,
    searchItems,
    totalItems:
      bundle.home.items.length +
      bundle.notifications.items.length +
      bundle.profileAlbums.items.length +
      bundle.profileEvents.items.length +
      searchDiscoveryItems +
      searchItems,
  };
}

function resolveUnreadCount(value: unknown) {
  const unreadCount =
    value && typeof value === "object"
      ? Number((value as { unreadCount?: unknown }).unreadCount || 0)
      : 0;
  return Number.isFinite(unreadCount) ? Math.max(0, unreadCount) : 0;
}

function shouldPreserveExistingNotificationBadge(params: {
  bundleSource: AppWarmupBundle["source"];
  existingBadge: unknown;
  nextBadge: AppWarmupBundle["notificationBadge"];
  notificationItemsLength: number;
}) {
  if (params.bundleSource === "timeout-backpressure") {
    return true;
  }

  return (
    params.bundleSource === "fallback" &&
    params.notificationItemsLength === 0 &&
    resolveUnreadCount(params.nextBadge) === 0 &&
    resolveUnreadCount(params.existingBadge) > 0
  );
}

function seedNotificationBadgeIntoCache(params: {
  bundleSource: AppWarmupBundle["source"];
  notificationBadge: AppWarmupBundle["notificationBadge"];
  notificationItemsLength: number;
  queryClient: QueryClient;
  viewerKey: string;
}) {
  const badgeKey = projectionKeys.notificationBadge(params.viewerKey);
  const existingBadge = params.queryClient.getQueryData(badgeKey);
  if (
    shouldPreserveExistingNotificationBadge({
      bundleSource: params.bundleSource,
      existingBadge,
      nextBadge: params.notificationBadge,
      notificationItemsLength: params.notificationItemsLength,
    })
  ) {
    return;
  }

  params.queryClient.setQueryData(badgeKey, params.notificationBadge);
}

/**
 * Progressive warmup: seed just home feed + notification badge into cache.
 * Called by the critical-path RPCs that resolve in ~300-500ms, so the home
 * screen shows content before the heavy monolithic bundle arrives (~2-3s).
 */
export function seedCriticalPathIntoCache(params: {
  home: AppWarmupBundle["home"];
  homeScope?: string;
  notificationBadge: AppWarmupBundle["notificationBadge"];
  queryClient: QueryClient;
  viewerKey: string;
}): boolean {
  if (params.home.items.length === 0) return false;

  const homeKey = projectionKeys.home(params.viewerKey, params.homeScope || HOME_WARMUP_SCOPE);
  applyProjectionEnvelope({
    entity: "home-feed",
    envelope: params.home,
    mode: "replace",
    queryClient: params.queryClient,
    screenKey: homeKey,
  });
  noteProjectionPrefetch({
    queryKey: homeKey,
    source: "warmup",
    status: "network",
  });

  params.queryClient.setQueryData(
    projectionKeys.notificationBadge(params.viewerKey),
    params.notificationBadge,
  );

  debugLog("WARMUP", "critical-path-seeded", {
    homeItems: params.home.items.length,
    scope: params.homeScope || HOME_WARMUP_SCOPE,
  });

  return true;
}

export function seedWarmupBundleIntoCache(params: {
  bundle: AppWarmupBundle;
  queryClient: QueryClient;
  /** Skip home + badge seeding if the critical path already seeded them. */
  skipCriticalPath?: boolean;
  viewerKey: string;
  viewerUsername: string;
}) {
  const profileUsername =
    String(params.bundle.profileUsername || params.viewerUsername)
      .trim()
      .toLowerCase() || params.viewerUsername;
  const hasProfileOverview =
    Boolean(params.bundle.profileOverview?.profile?.id) ||
    Boolean(params.bundle.profileOverview?.profile?.username);
  const hasSearchDiscoveryContent = SEARCH_DISCOVERY_KINDS.some(
    (kind) => (params.bundle.searchDiscovery[kind]?.items.length || 0) > 0,
  );
  const hasTypedSearchContent = Boolean(params.bundle.search?.content.items.length);

  // Only seed envelopes that have actual items. Seeding empty envelopes
  // poisons the delta-sync path: the screen sees hasCachedSnapshot=true
  // with deltaToken=now, does a delta sync that returns 0 changes, and
  // items stay at 0 permanently until a manual refresh.
  if (!params.skipCriticalPath && params.bundle.home.items.length > 0) {
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
    noteProjectionPrefetch({
      queryKey: homeKey,
      source: "warmup",
      status: "network",
    });
  }
  if (!params.skipCriticalPath) {
    seedNotificationBadgeIntoCache({
      bundleSource: params.bundle.source,
      notificationBadge: params.bundle.notificationBadge,
      notificationItemsLength: params.bundle.notifications.items.length,
      queryClient: params.queryClient,
      viewerKey: params.viewerKey,
    });
  }
  if (params.bundle.notifications.items.length > 0) {
    const notificationsKey = projectionKeys.notifications(
      params.viewerKey,
      NOTIFICATIONS_WARMUP_FILTER,
    );
    applyProjectionEnvelope({
      entity: "notifications",
      envelope: params.bundle.notifications,
      mode: "replace",
      queryClient: params.queryClient,
      screenKey: notificationsKey,
    });
    noteProjectionPrefetch({
      queryKey: notificationsKey,
      source: "warmup",
      status: "network",
    });
  }
  if (hasProfileOverview) {
    const profileOverviewKey = projectionKeys.profileOverview(profileUsername, params.viewerKey);
    params.queryClient.setQueryData(profileOverviewKey, params.bundle.profileOverview);
    noteProjectionPrefetch({
      queryKey: profileOverviewKey,
      source: "warmup",
      status: "network",
    });
    if (params.bundle.profileAlbums.items.length > 0) {
      const profileAlbumsKey = projectionKeys.profileContent(
        profileUsername,
        "album",
        params.viewerKey,
      );
      applyProjectionEnvelope({
        entity: "profile-albums",
        envelope: params.bundle.profileAlbums,
        mode: "replace",
        queryClient: params.queryClient,
        screenKey: profileAlbumsKey,
      });
      noteProjectionPrefetch({
        queryKey: profileAlbumsKey,
        source: "warmup",
        status: "network",
      });
    }
    if (params.bundle.profileEvents.items.length > 0) {
      const profileEventsKey = projectionKeys.profileContent(
        profileUsername,
        "events",
        params.viewerKey,
      );
      applyProjectionEnvelope({
        entity: "profile-events",
        envelope: params.bundle.profileEvents,
        mode: "replace",
        queryClient: params.queryClient,
        screenKey: profileEventsKey,
      });
      noteProjectionPrefetch({
        queryKey: profileEventsKey,
        source: "warmup",
        status: "network",
      });
    }
  }

  if (hasSearchDiscoveryContent) {
    SEARCH_DISCOVERY_KINDS.forEach((kind) => {
      const envelope = params.bundle.searchDiscovery[kind];
      if (envelope.items.length > 0) {
        const searchDiscoveryKey = projectionKeys.search(
          kind,
          params.viewerKey,
          SEARCH_DISCOVERY_SCOPE,
        );
        applyProjectionEnvelope({
          entity: resolveSearchProjectionEntity(kind),
          envelope,
          mode: "replace",
          queryClient: params.queryClient,
          screenKey: searchDiscoveryKey,
        });
        noteProjectionPrefetch({
          queryKey: searchDiscoveryKey,
          source: "warmup",
          status: "network",
        });
      }
    });
  }

  if (params.bundle.search && hasTypedSearchContent) {
    const typedSearchKey = projectionKeys.search(
      params.bundle.search.kind,
      params.viewerKey,
      params.bundle.search.scope,
    );
    applyProjectionEnvelope({
      entity: resolveSearchProjectionEntity(params.bundle.search.kind),
      envelope: params.bundle.search.content,
      mode: "replace",
      queryClient: params.queryClient,
      screenKey: typedSearchKey,
    });
    noteProjectionPrefetch({
      queryKey: typedSearchKey,
      source: "warmup",
      status: "network",
    });
  }

  return {
    profileUsername,
  };
}
