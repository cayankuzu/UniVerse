import type { QueryClient } from "@tanstack/react-query";
import { projectionKeys } from "../projections/projectionKeys";
import type { ContentMutationResult, MutationRefreshPolicy } from "../projections/mutationPolicy";
import { applyMutationRefreshPolicy } from "../projections/mutationPolicy";
import {
  applyEntityPatches,
  touchProjectionScreensContainingIds,
} from "../projections/patchEnvelope";
import { removeProjectionItemIds } from "../projections/projections";

function patchArrayEntity<T extends { id?: string }>(
  current: unknown,
  id: string,
  patch: Partial<T>,
) {
  if (!Array.isArray(current)) return current;
  return current.map((item) => {
    if (!item || typeof item !== "object") return item;
    const row = item as T;
    if (String(row.id || "") !== id) return item;
    return { ...row, ...patch };
  });
}

function removeArrayEntity<T extends { id?: string }>(current: unknown, id: string) {
  if (!Array.isArray(current)) return current;
  return current.filter((item) => {
    if (!item || typeof item !== "object") return true;
    return String((item as T).id || "") !== id;
  });
}

function buildAlbumRefreshPolicy(eventId?: string): MutationRefreshPolicy {
  const refreshKeys = [] as ReturnType<typeof projectionKeys.screen>[];
  if (eventId) {
    refreshKeys.push(
      projectionKeys.screen("album-event", eventId),
      projectionKeys.screen("event-detail", eventId),
    );
  }
  return {
    refreshKeys,
  };
}

function touchAlbumProjectionScreens(queryClient: QueryClient, photoId: string) {
  touchProjectionScreensContainingIds(queryClient, {
    ids: [photoId, `album:${photoId}`],
    screenDomains: ["album-event", "home", "profile-content", "search"],
  });
}

function removeAlbumProjectionScreens(queryClient: QueryClient, photoId: string) {
  const normalizedId = String(photoId || "").trim();
  const homeId = `album:${normalizedId}`;
  if (!normalizedId) return;

  queryClient.getQueriesData({ queryKey: ["screen"] }).forEach(([screenKey]) => {
    if (!Array.isArray(screenKey)) return;
    const domain = String(screenKey[1] || "")
      .trim()
      .toLowerCase();

    if (domain === "home") {
      removeProjectionItemIds({
        entity: "home-feed",
        ids: [homeId],
        queryClient,
        screenKey,
      });
      return;
    }

    if (domain === "album-event") {
      removeProjectionItemIds({
        entity: "album-event",
        ids: [normalizedId],
        queryClient,
        screenKey,
      });
      return;
    }

    if (
      domain === "profile-content" &&
      String(screenKey[3] || "")
        .trim()
        .toLowerCase() === "album"
    ) {
      removeProjectionItemIds({
        entity: "profile-albums",
        ids: [normalizedId],
        queryClient,
        screenKey,
      });
      return;
    }

    if (
      domain === "search" &&
      String(screenKey[2] || "")
        .trim()
        .toLowerCase() === "albums"
    ) {
      removeProjectionItemIds({
        entity: "search-albums",
        ids: [normalizedId],
        queryClient,
        screenKey,
      });
    }
  });
}

function decrementAlbumCount(queryClient: QueryClient, eventId?: string) {
  const normalizedEventId = String(eventId || "").trim();
  if (!normalizedEventId) return;
  const currentDetail = queryClient.getQueryData(
    projectionKeys.entity("event-detail", normalizedEventId),
  ) as { albumCount?: number; event?: { albumCount?: number } } | null;
  if (!currentDetail) return;

  const nextAlbumCount = Math.max(
    0,
    Number(currentDetail.albumCount || currentDetail.event?.albumCount || 0) - 1,
  );
  applyEntityPatches(queryClient, [
    {
      changes: {
        albumCount: nextAlbumCount,
        event: currentDetail.event
          ? { ...currentDetail.event, albumCount: nextAlbumCount }
          : currentDetail.event,
      },
      entity: "event-detail",
      id: normalizedEventId,
    },
  ]);
}

export function patchAlbumMutationCaches<T extends { id?: string }>(params: {
  eventId?: string;
  patch: Partial<T>;
  photoId: string;
  queryClient: QueryClient;
}) {
  const { patch, photoId, queryClient } = params;
  const normalizedId = String(photoId || "").trim();
  if (!normalizedId) return;

  [["albums", "feed"] as const, ["profile", "albums"] as const].forEach((queryKey) => {
    queryClient.setQueriesData({ queryKey }, (current: unknown) =>
      patchArrayEntity<T>(current, normalizedId, patch),
    );
  });
  queryClient.setQueryData(["entity", "profile-albums", normalizedId], (current: unknown) => {
    if (!current || typeof current !== "object") return current;
    return { ...(current as T), ...patch };
  });
  queryClient.setQueryData(["entity", "search-albums", normalizedId], (current: unknown) => {
    if (!current || typeof current !== "object") return current;
    return { ...(current as T), ...patch };
  });
  queryClient.setQueryData(
    projectionKeys.entity("album-event", normalizedId),
    (current: unknown) => {
      if (!current || typeof current !== "object") return current;
      return { ...(current as T), ...patch };
    },
  );
  queryClient.setQueriesData({ queryKey: ["entity", "home-feed"] }, (current: unknown) => {
    if (!current || typeof current !== "object") return current;
    const row = current as { album?: T; kind?: string };
    if (row.kind !== "album" || String(row.album?.id || "") !== normalizedId) return current;
    return { ...row, album: { ...(row.album as T), ...patch } };
  });
  touchAlbumProjectionScreens(queryClient, normalizedId);
}

export function refreshAlbumMutationScopes(
  queryClient: QueryClient,
  eventId?: string,
): ContentMutationResult {
  const refreshPolicy = buildAlbumRefreshPolicy(eventId);
  if (eventId) {
    touchProjectionScreensContainingIds(queryClient, {
      ids: [eventId],
      screenDomains: ["event-detail"],
    });
  }
  applyMutationRefreshPolicy(queryClient, refreshPolicy);
  return { refreshPolicy };
}

export function removeAlbumMutationCaches<T extends { id?: string }>(params: {
  eventId?: string;
  photoId: string;
  queryClient: QueryClient;
}) {
  const { eventId, photoId, queryClient } = params;
  const normalizedId = String(photoId || "").trim();
  if (!normalizedId) return;

  [["albums", "feed"] as const, ["profile", "albums"] as const].forEach((queryKey) => {
    queryClient.setQueriesData({ queryKey }, (current: unknown) =>
      removeArrayEntity<T>(current, normalizedId),
    );
  });
  queryClient.setQueriesData({ queryKey: ["entity", "home-feed"] }, (current: unknown) => {
    if (!current || typeof current !== "object") return current;
    const row = current as { album?: T; kind?: string };
    if (row.kind !== "album" || String(row.album?.id || "") !== normalizedId) return current;
    return null;
  });
  queryClient.removeQueries({ queryKey: ["entity", "profile-albums", normalizedId], exact: true });
  queryClient.removeQueries({ queryKey: ["entity", "search-albums", normalizedId], exact: true });
  queryClient.removeQueries({
    queryKey: projectionKeys.entity("album-event", normalizedId),
    exact: true,
  });
  removeAlbumProjectionScreens(queryClient, normalizedId);
  decrementAlbumCount(queryClient, eventId);
  touchAlbumProjectionScreens(queryClient, normalizedId);
  applyMutationRefreshPolicy(queryClient, buildAlbumRefreshPolicy(eventId));
}
