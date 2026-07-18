import type { QueryClient } from "@tanstack/react-query";
import { projectionKeys } from "../projections/projectionKeys";
import type { ContentMutationResult, MutationRefreshPolicy } from "../projections/mutationPolicy";
import { applyMutationRefreshPolicy } from "../projections/mutationPolicy";
import { touchProjectionScreensContainingIds } from "../projections/patchEnvelope";

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

function buildEventRefreshPolicy(eventId: string): MutationRefreshPolicy {
  return {
    refreshKeys: [
      projectionKeys.screen("event-detail", eventId),
      projectionKeys.screen("album-event", eventId),
    ],
  };
}

function touchEventProjectionScreens(queryClient: QueryClient, eventId: string) {
  touchProjectionScreensContainingIds(queryClient, {
    ids: [eventId, `event:${eventId}`],
    screenDomains: ["event-detail", "home", "profile-content", "search"],
  });
}

export function patchEventMutationCaches<T extends { id?: string }>(params: {
  eventId: string;
  patch: Partial<T>;
  queryClient: QueryClient;
}) {
  const { eventId, patch, queryClient } = params;
  const normalizedId = String(eventId || "").trim();
  if (!normalizedId) return;

  [["events", "feed"] as const, ["profile", "events"] as const].forEach((queryKey) => {
    queryClient.setQueriesData({ queryKey }, (current: unknown) =>
      patchArrayEntity<T>(current, normalizedId, patch),
    );
  });
  queryClient.setQueryData(["entity", "profile-events", normalizedId], (current: unknown) => {
    if (!current || typeof current !== "object") return current;
    return { ...(current as T), ...patch };
  });
  queryClient.setQueryData(["entity", "search-events", normalizedId], (current: unknown) => {
    if (!current || typeof current !== "object") return current;
    return { ...(current as T), ...patch };
  });
  queryClient.setQueriesData({ queryKey: ["entity", "home-feed"] }, (current: unknown) => {
    if (!current || typeof current !== "object") return current;
    const row = current as { event?: T; kind?: string };
    if (row.kind !== "event" || String(row.event?.id || "") !== normalizedId) {
      return current;
    }
    return { ...row, event: { ...(row.event as T), ...patch } };
  });
  queryClient.setQueryData(
    projectionKeys.entity("event-detail", normalizedId),
    (current: unknown) => {
      if (!current || typeof current !== "object") return current;
      const row = current as { event?: T };
      if (!row.event) return current;
      return { ...row, event: { ...(row.event as T), ...patch } };
    },
  );
  touchEventProjectionScreens(queryClient, normalizedId);
}

export function refreshEventMutationScopes(
  queryClient: QueryClient,
  eventId: string,
): ContentMutationResult {
  const refreshPolicy = buildEventRefreshPolicy(eventId);
  touchEventProjectionScreens(queryClient, eventId);
  applyMutationRefreshPolicy(queryClient, refreshPolicy);
  return { refreshPolicy };
}

export function removeEventMutationCaches<T extends { id?: string }>(params: {
  eventId: string;
  queryClient: QueryClient;
}) {
  const { eventId, queryClient } = params;
  const normalizedId = String(eventId || "").trim();
  if (!normalizedId) return;

  [["events", "feed"] as const, ["profile", "events"] as const].forEach((queryKey) => {
    queryClient.setQueriesData({ queryKey }, (current: unknown) =>
      removeArrayEntity<T>(current, normalizedId),
    );
  });
  queryClient.setQueriesData({ queryKey: ["entity", "home-feed"] }, (current: unknown) => {
    if (!current || typeof current !== "object") return current;
    const row = current as { event?: T; kind?: string };
    if (row.kind !== "event" || String(row.event?.id || "") !== normalizedId) return current;
    return null;
  });
  queryClient.removeQueries({
    queryKey: projectionKeys.entity("event-detail", normalizedId),
    exact: true,
  });
  queryClient.removeQueries({
    queryKey: ["entity", "profile-events", normalizedId],
    exact: true,
  });
  queryClient.removeQueries({
    queryKey: ["entity", "search-events", normalizedId],
    exact: true,
  });
  touchEventProjectionScreens(queryClient, normalizedId);
  applyMutationRefreshPolicy(queryClient, buildEventRefreshPolicy(normalizedId));
}
