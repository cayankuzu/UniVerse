import type { NotificationItem } from "../contracts/api";
import type { AlbumPhotoWithMeta, EventWithMeta } from "../contracts/content";
import { nowEnvelope } from "./projections.api.helpers";
import type {
  AppWarmupBundle,
  NotificationBadgeProjection,
  ProjectionHomeFeedItem,
} from "./projections.types";
import {
  buildEmptyProfileOverview,
  buildEmptySearchDiscoveryBundle,
} from "./projections.warmup.normalize";
import {
  FALLBACK_RPC_TIMEOUT_MS,
  HOME_WARMUP_LIMIT,
  NOTIFICATIONS_WARMUP_LIMIT,
  type WarmupBundleParams,
  type WarmupDelegates,
} from "./projections.warmup.contracts";

export function withFallbackTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), FALLBACK_RPC_TIMEOUT_MS)),
  ]);
}

async function resolveWarmupFallbackPiece<T>(task: Promise<T>, fallback: T): Promise<T> {
  try {
    return await withFallbackTimeout(task, fallback);
  } catch {
    return fallback;
  }
}

export async function buildFallbackWarmupBundle(params: {
  delegates: WarmupDelegates;
  normalizedViewerUsername: string;
  preferredHomeScope: string;
  request: WarmupBundleParams;
}): Promise<AppWarmupBundle> {
  const { delegates, normalizedViewerUsername, preferredHomeScope, request } = params;

  if (request.skipHomeBadgeInFallback) {
    return {
      generatedAt: new Date().toISOString(),
      home: nowEnvelope<ProjectionHomeFeedItem>([]),
      homeScope: preferredHomeScope,
      notificationBadge: { id: "notifications", unreadCount: 0 },
      notifications: nowEnvelope<NotificationItem>([]),
      profileAlbums: nowEnvelope<AlbumPhotoWithMeta>([]),
      profileEvents: nowEnvelope<EventWithMeta>([]),
      profileOverview: buildEmptyProfileOverview(normalizedViewerUsername),
      profileUsername: normalizedViewerUsername,
      source: "fallback",
      searchDiscovery: buildEmptySearchDiscoveryBundle(),
      search: null,
    };
  }

  const [home, notificationBadge, notifications] = await Promise.all([
    resolveWarmupFallbackPiece(
      delegates.getHomeFeed(
        {
          entityFilter: request.home?.entityFilter || "all",
          sortOption: request.home?.sortOption || "newest",
          sourceFilter: request.home?.sourceFilter || "all",
          typeFilter: request.home?.typeFilter || "all",
          viewerAccountType: request.viewerAccountType,
          viewerId: request.viewerId,
          viewerUsername: normalizedViewerUsername,
        },
        { limit: HOME_WARMUP_LIMIT },
      ),
      nowEnvelope<ProjectionHomeFeedItem>([]),
    ),
    resolveWarmupFallbackPiece(delegates.getNotificationBadge(request.viewerId), {
      id: "notifications",
      unreadCount: 0,
    } as NotificationBadgeProjection),
    resolveWarmupFallbackPiece(
      delegates.getNotifications("all", request.viewerId, {
        limit: NOTIFICATIONS_WARMUP_LIMIT,
      }),
      nowEnvelope<NotificationItem>([]),
    ),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    home,
    homeScope: preferredHomeScope,
    notificationBadge,
    notifications,
    profileAlbums: nowEnvelope<AlbumPhotoWithMeta>([]),
    profileEvents: nowEnvelope<EventWithMeta>([]),
    profileOverview: buildEmptyProfileOverview(normalizedViewerUsername),
    profileUsername: normalizedViewerUsername,
    source: "fallback",
    searchDiscovery: buildEmptySearchDiscoveryBundle(),
    search: null,
  };
}
