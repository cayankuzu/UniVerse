import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { projectionKeys } from "./projectionKeys";
import { serializeProjectionKey } from "./projections";
import { getProjectionState } from "./projections";
import { markProjectionStale } from "./patchEnvelope";
import { scheduleProjectionSync } from "./sync/syncOrchestrator";
import { useUiViewStateStore } from "./uiViewState";

export type ProjectionRealtimeEvent =
  | {
      kind: "content-engagement-changed";
      eventIds?: string[] | null;
      photoIds?: string[] | null;
      viewerKey: string;
    }
  | { kind: "notifications-upsert"; unreadDelta?: number; viewerKey: string }
  | { kind: "notifications-updated"; viewerKey: string }
  | {
      kind: "profile-social-changed";
      targetProfileIds?: string[] | null;
      targetUsernames?: string[] | null;
      viewerKey: string;
      viewerUsername?: string | null;
    };

function normalize(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeIdSet(values: string[] | null | undefined) {
  return new Set(
    (Array.isArray(values) ? values : []).map((value) => normalize(value)).filter(Boolean),
  );
}

function screenIncludesAnyId(queryClient: QueryClient, screenKey: QueryKey, ids: Set<string>) {
  if (!ids.size) return false;
  const state = getProjectionState(queryClient, screenKey);
  return Boolean(state?.ids?.some((id) => ids.has(normalize(id))));
}

function markProjectionQueryStale(
  queryClient: QueryClient,
  screenKey: QueryKey,
  uiScreenKey?: string,
  deferSync = false,
) {
  markProjectionStale(queryClient, screenKey);
  if (!deferSync) {
    scheduleProjectionSync(serializeProjectionKey(screenKey));
  }
  if (uiScreenKey) {
    useUiViewStateStore.getState().markNewContentAvailable(uiScreenKey);
  }
}

function markProjectionMatchesStale(
  queryClient: QueryClient,
  queryKey: QueryKey,
  predicate: (screenKey: QueryKey) => boolean,
  resolveUiScreenKey?: (screenKey: QueryKey) => string | undefined,
  deferSync = false,
) {
  queryClient.getQueriesData({ queryKey }).forEach(([screenKey]) => {
    const resolvedScreenKey = screenKey as QueryKey;
    if (!predicate(resolvedScreenKey)) return;
    markProjectionQueryStale(
      queryClient,
      resolvedScreenKey,
      resolveUiScreenKey?.(resolvedScreenKey),
      deferSync,
    );
  });
}

function markProjectionPrefixStale(
  queryClient: QueryClient,
  queryKey: QueryKey,
  uiScreenKey?: string,
  deferSync = false,
) {
  markProjectionMatchesStale(
    queryClient,
    queryKey,
    () => true,
    () => uiScreenKey,
    deferSync,
  );
}

function markViewerProfileContentTabStale(
  queryClient: QueryClient,
  tab: "album" | "events",
  viewerKey: string,
  ids: Set<string>,
  deferSync = false,
) {
  if (!ids.size) return;
  markProjectionMatchesStale(
    queryClient,
    projectionKeys.screen("profile-content"),
    (screenKey) =>
      normalize(screenKey[3]) === normalize(tab) &&
      normalize(screenKey[4]) === normalize(viewerKey) &&
      screenIncludesAnyId(queryClient, screenKey, ids),
    undefined,
    deferSync,
  );
}

function markAlbumEventScreenByPhotoIds(
  queryClient: QueryClient,
  photoIds: Set<string>,
  deferSync = false,
) {
  if (!photoIds.size) return;
  markProjectionMatchesStale(
    queryClient,
    projectionKeys.screen("album-event"),
    (screenKey) => screenIncludesAnyId(queryClient, screenKey, photoIds),
    undefined,
    deferSync,
  );
}

function resolveCachedProfileUsernameById(queryClient: QueryClient, profileId: string) {
  const normalizedProfileId = normalize(profileId);
  if (!normalizedProfileId) return "";
  const cachedOverview = queryClient.getQueriesData({
    queryKey: projectionKeys.screen("profile-overview"),
  });
  for (const [, data] of cachedOverview) {
    const row =
      data && typeof data === "object"
        ? (data as {
            profile?: { id?: string | null; userId?: string | null; username?: string | null };
            username?: string | null;
          })
        : null;
    const rowProfileId = normalize(row?.profile?.id || row?.profile?.userId || "");
    if (rowProfileId !== normalizedProfileId) continue;
    const username = normalize(row?.profile?.username || row?.username || "");
    if (username) return username;
  }
  return "";
}

function patchNotificationBadge(queryClient: QueryClient, viewerKey: string, delta: number) {
  if (!delta) return;
  const badgeKey = projectionKeys.notificationBadge(viewerKey);
  queryClient.setQueryData(badgeKey, (current: unknown) => {
    const row =
      current && typeof current === "object"
        ? (current as { id?: string; unreadCount?: number })
        : { id: "notifications", unreadCount: 0 };
    return {
      id: row.id || "notifications",
      unreadCount: Math.max(0, Number(row.unreadCount || 0) + delta),
    };
  });
}

export function applyProjectionRealtimeEvent(params: {
  deferSync?: boolean;
  event: ProjectionRealtimeEvent;
  queryClient: QueryClient;
}) {
  const { deferSync = false, event, queryClient } = params;

  if (event.kind === "notifications-upsert") {
    patchNotificationBadge(queryClient, event.viewerKey, Number(event.unreadDelta || 0));
    markProjectionPrefixStale(
      queryClient,
      projectionKeys.notifications(event.viewerKey, "all"),
      serializeProjectionKey(projectionKeys.notifications(event.viewerKey, "all")),
      deferSync,
    );
    return;
  }

  if (event.kind === "notifications-updated") {
    markProjectionPrefixStale(
      queryClient,
      projectionKeys.notifications(event.viewerKey, "all"),
      serializeProjectionKey(projectionKeys.notifications(event.viewerKey, "all")),
      deferSync,
    );
    return;
  }

  if (event.kind === "content-engagement-changed") {
    const eventIds = normalizeIdSet(event.eventIds);
    const photoIds = normalizeIdSet(event.photoIds);
    eventIds.forEach((eventId) => {
      markProjectionPrefixStale(
        queryClient,
        projectionKeys.eventDetail(eventId, event.viewerKey),
        undefined,
        deferSync,
      );
      markProjectionPrefixStale(
        queryClient,
        projectionKeys.albumEvent(eventId, event.viewerKey),
        undefined,
        deferSync,
      );
    });
    markViewerProfileContentTabStale(queryClient, "events", event.viewerKey, eventIds, deferSync);
    markAlbumEventScreenByPhotoIds(queryClient, photoIds, deferSync);
    markViewerProfileContentTabStale(queryClient, "album", event.viewerKey, photoIds, deferSync);
    return;
  }

  markProjectionPrefixStale(
    queryClient,
    projectionKeys.screen("home", event.viewerKey),
    undefined,
    deferSync,
  );
  markProjectionPrefixStale(
    queryClient,
    projectionKeys.screen("notifications"),
    undefined,
    deferSync,
  );
  markProjectionPrefixStale(
    queryClient,
    projectionKeys.blockedUsers(event.viewerKey),
    undefined,
    deferSync,
  );
  markProjectionPrefixStale(
    queryClient,
    projectionKeys.screen("event-comments"),
    undefined,
    deferSync,
  );
  markProjectionPrefixStale(
    queryClient,
    projectionKeys.screen("event-likers"),
    undefined,
    deferSync,
  );
  markProjectionPrefixStale(
    queryClient,
    projectionKeys.screen("event-attendees"),
    undefined,
    deferSync,
  );
  markProjectionPrefixStale(
    queryClient,
    projectionKeys.screen("album-comments"),
    undefined,
    deferSync,
  );
  markProjectionPrefixStale(
    queryClient,
    projectionKeys.screen("album-event"),
    undefined,
    deferSync,
  );
  markProjectionPrefixStale(
    queryClient,
    projectionKeys.screen("event-detail"),
    undefined,
    deferSync,
  );
  if (event.viewerUsername) {
    markProjectionPrefixStale(
      queryClient,
      projectionKeys.profileOverview(event.viewerUsername, event.viewerKey),
      undefined,
      deferSync,
    );
  }
  const targetUsernames = new Set(
    (Array.isArray(event.targetUsernames) ? event.targetUsernames : [])
      .map((value) => normalize(value))
      .filter(Boolean),
  );
  (Array.isArray(event.targetProfileIds) ? event.targetProfileIds : []).forEach((profileId) => {
    const resolved = resolveCachedProfileUsernameById(queryClient, String(profileId || ""));
    if (resolved) targetUsernames.add(resolved);
  });
  targetUsernames.forEach((targetUsername) => {
    markProjectionPrefixStale(
      queryClient,
      projectionKeys.relationships(targetUsername, "followers", event.viewerKey),
      undefined,
      deferSync,
    );
    markProjectionPrefixStale(
      queryClient,
      projectionKeys.relationships(targetUsername, "following", event.viewerKey),
      undefined,
      deferSync,
    );
  });
}
