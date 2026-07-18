import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { projectionKeys } from "./projectionKeys";
import { serializeProjectionKey } from "./projections";
import { scheduleProjectionSync } from "./sync/syncOrchestrator";
import { markProjectionStale } from "./patchEnvelope";
import type { ProjectionMergeMode } from "./projectionMerge";

function setProjectionRefreshMode(
  queryClient: QueryClient,
  queryKey: QueryKey,
  mode: ProjectionMergeMode,
) {
  queryClient.setQueriesData({ queryKey }, (current: unknown) => {
    if (!current || typeof current !== "object") return current;
    return {
      ...(current as Record<string, unknown>),
      forceRefreshMode: mode,
      isStale: true,
      touchedAt: Date.now(),
    };
  });
}

function scheduleProjectionScopeSync(queryClient: QueryClient, queryKey: QueryKey) {
  queryClient.getQueriesData({ queryKey }).forEach(([screenKey]) => {
    scheduleProjectionSync(serializeProjectionKey(screenKey), 0);
  });
}

export function refreshProjectionScope(queryClient: QueryClient, queryKey: QueryKey) {
  markProjectionStale(queryClient, queryKey);
  scheduleProjectionScopeSync(queryClient, queryKey);
}

export function replaceProjectionScope(queryClient: QueryClient, queryKey: QueryKey) {
  setProjectionRefreshMode(queryClient, queryKey, "replace");
  scheduleProjectionScopeSync(queryClient, queryKey);
}

export function hardRefreshProjectionScope(queryClient: QueryClient, queryKey: QueryKey) {
  refreshProjectionScope(queryClient, queryKey);
}

export function refreshViewerHomeAndSearch(queryClient: QueryClient, viewerKey: string) {
  hardRefreshProjectionScope(queryClient, projectionKeys.screen("home", viewerKey));
  hardRefreshProjectionScope(queryClient, projectionKeys.screen("search", "events", viewerKey));
  hardRefreshProjectionScope(queryClient, projectionKeys.screen("search", "albums", viewerKey));
  hardRefreshProjectionScope(queryClient, projectionKeys.screen("search", "clubs", viewerKey));
  hardRefreshProjectionScope(queryClient, projectionKeys.screen("search", "students", viewerKey));
}

export function refreshViewerPrivacySensitiveScreens(
  queryClient: QueryClient,
  viewerKey: string,
  username?: string,
) {
  refreshViewerHomeAndSearch(queryClient, viewerKey);
  hardRefreshProjectionScope(queryClient, projectionKeys.screen("notifications"));
  hardRefreshProjectionScope(queryClient, projectionKeys.blockedUsers(viewerKey));
  hardRefreshProjectionScope(queryClient, projectionKeys.screen("profile-overview"));
  hardRefreshProjectionScope(queryClient, projectionKeys.screen("profile-screen"));
  hardRefreshProjectionScope(queryClient, projectionKeys.screen("profile-content"));
  hardRefreshProjectionScope(queryClient, projectionKeys.screen("relationships"));
  hardRefreshProjectionScope(queryClient, projectionKeys.screen("event-detail"));
  hardRefreshProjectionScope(queryClient, projectionKeys.screen("album-event"));
  hardRefreshProjectionScope(queryClient, projectionKeys.screen("event-comments"));
  hardRefreshProjectionScope(queryClient, projectionKeys.screen("event-likers"));
  hardRefreshProjectionScope(queryClient, projectionKeys.screen("event-attendees"));
  hardRefreshProjectionScope(queryClient, projectionKeys.screen("album-comments"));
  if (!username) return;
  hardRefreshProjectionScope(queryClient, projectionKeys.profileOverview(username, viewerKey));
  hardRefreshProjectionScope(
    queryClient,
    projectionKeys.profileScreen(username, "album", viewerKey),
  );
  hardRefreshProjectionScope(
    queryClient,
    projectionKeys.profileScreen(username, "events", viewerKey),
  );
  hardRefreshProjectionScope(
    queryClient,
    projectionKeys.profileContent(username, "album", viewerKey),
  );
  hardRefreshProjectionScope(
    queryClient,
    projectionKeys.profileContent(username, "events", viewerKey),
  );
}
