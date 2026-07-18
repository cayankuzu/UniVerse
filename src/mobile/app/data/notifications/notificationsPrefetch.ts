import type { QueryClient } from "@tanstack/react-query";
import { prefetchProjectionScreen } from "../projections/prefetch/prefetchProjection";
import type { ProjectionPrefetchSource } from "../projections/prefetch/prefetchRegistry";
import type { ViewerContext } from "../projections/viewerContext";
import { getNotificationsQueryDef } from "./notificationsProjectionRepository";
import { prefetchLandingMedia } from "../projections/prefetch/prefetchLandingMedia";
import { readProjectionItems } from "../projections/projections";

export async function prefetchNotificationsLandingExperience(params: {
  queryClient: QueryClient;
  source?: ProjectionPrefetchSource;
  viewer: ViewerContext;
}) {
  const viewerUsername = String(params.viewer.username || "").trim();
  if (!viewerUsername) return;

  const notificationsDef = getNotificationsQueryDef({
    filter: "all",
    viewer: params.viewer,
  });
  const source = params.source || "intent";

  await prefetchProjectionScreen({
    entity: notificationsDef.entity,
    fetchProjection: () =>
      notificationsDef.fetchProjection({
        cursor: null,
        deltaToken: null,
        limit: notificationsDef.pageSize,
        mode: "replace",
        since: null,
      }),
    queryClient: params.queryClient,
    queryKey: notificationsDef.queryKey,
    source,
    staleTime: notificationsDef.staleTime,
  });

  await prefetchLandingMedia({
    items: readProjectionItems(
      params.queryClient,
      notificationsDef.queryKey,
      notificationsDef.entity,
    ),
    maxImages: 3,
    screenKey: `notifications:${viewerUsername}`,
    source,
  });
}
