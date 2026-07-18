import type { QueryClient } from "@tanstack/react-query";
import {
  prefetchProjectionScreen,
  runProjectionPrefetchTask,
} from "../../../data/projections/prefetch/prefetchProjection";
import type { ProjectionPrefetchSource } from "../../../data/projections/prefetch/prefetchRegistry";
import type { ViewerContext } from "../../../data/projections/viewerContext";
import type { ProfileContentTab } from "../../../data/projections/projections.types";
import { prefetchLandingMedia } from "../../../data/projections/prefetch/prefetchLandingMedia";
import { readProjectionItems } from "../../../data/projections/projections";
import { getOwnProfileContentQueryDef, getOwnProfileOverviewQueryDef } from "./profileRepository";

function createInitialProfileProjectionContext(limit: number) {
  return {
    cursor: null,
    deltaToken: null,
    limit,
    mode: "replace" as const,
    since: null,
  };
}

export async function prefetchOwnProfileLandingExperience(params: {
  preferredTab?: ProfileContentTab;
  queryClient: QueryClient;
  source?: ProjectionPrefetchSource;
  viewer: ViewerContext;
}) {
  const viewerUsername = String(params.viewer.username || "").trim();
  if (!viewerUsername) return;

  const preferredTab = params.preferredTab || "album";
  const overviewDef = getOwnProfileOverviewQueryDef(params.viewer);
  const contentDef = getOwnProfileContentQueryDef({
    tab: preferredTab,
    viewer: params.viewer,
  });
  const source = params.source || "intent";

  await Promise.allSettled([
    runProjectionPrefetchTask({
      key: `profile-overview-prefetch:${JSON.stringify(overviewDef.queryKey)}`,
      source,
      task: () =>
        params.queryClient.prefetchQuery({
          queryFn: overviewDef.queryFn,
          queryKey: overviewDef.queryKey,
          staleTime: overviewDef.staleTime,
        }),
    }),
    prefetchProjectionScreen({
      entity: contentDef.entity,
      fetchProjection: () =>
        contentDef.fetchProjection(createInitialProfileProjectionContext(contentDef.pageSize)),
      queryClient: params.queryClient,
      queryKey: contentDef.queryKey,
      source,
      staleTime: contentDef.staleTime,
    }),
  ]);

  const overview = params.queryClient.getQueryData(overviewDef.queryKey);
  const contentItems = readProjectionItems(
    params.queryClient,
    contentDef.queryKey,
    contentDef.entity,
  );
  await prefetchLandingMedia({
    items: [overview, ...contentItems],
    maxImages: 3,
    screenKey: `profile:${viewerUsername}:${preferredTab}`,
    source,
  });
}
