import type { QueryClient } from "@tanstack/react-query";
import type { ProjectionPrefetchSource } from "../../../data/projections/prefetch/prefetchRegistry";
import type { ViewerContext } from "../../../data/projections/viewerContext";
import { prefetchProjectionScreen } from "../../../data/projections/prefetch/prefetchProjection";
import { prefetchLandingMedia } from "../../../data/projections/prefetch/prefetchLandingMedia";
import { readProjectionItems } from "../../../data/projections/projections";
import type { PersistedSearchWarmupScope } from "../../../data/projections/warmupPreferences";
import { getSearchQueryDef } from "./searchRepository";

export async function prefetchSearchLandingExperience(params: {
  preferredScope?: PersistedSearchWarmupScope | null;
  queryClient: QueryClient;
  source?: ProjectionPrefetchSource;
  viewer: ViewerContext;
}) {
  const viewerUsername = String(params.viewer.username || "").trim();
  if (!viewerUsername) return;

  const source = params.source || "intent";
  const preferredDefinition = params.preferredScope
    ? getSearchQueryDef({
        categoryFilter: params.preferredScope.categoryFilter,
        feeFilter: params.preferredScope.feeFilter,
        kind: params.preferredScope.kind,
        queryText: params.preferredScope.queryText,
        sortMode: params.preferredScope.sortMode,
        universityFilter: params.preferredScope.universityFilter,
        viewer: params.viewer,
      })
    : null;
  const searchDefinitions = [
    preferredDefinition ||
      getSearchQueryDef({
        kind: "albums",
        viewer: params.viewer,
      }),
  ];

  await Promise.allSettled(
    searchDefinitions.map((searchDef) =>
      prefetchProjectionScreen({
        entity: searchDef.entity,
        fetchProjection: () =>
          searchDef.fetchProjection({
            cursor: null,
            deltaToken: null,
            limit: searchDef.pageSize,
            mode: "replace",
            since: null,
          }),
        queryClient: params.queryClient,
        queryKey: searchDef.queryKey,
        source,
        staleTime: searchDef.staleTime,
      }),
    ),
  );

  const landingItems = searchDefinitions.flatMap((searchDef) =>
    readProjectionItems(params.queryClient, searchDef.queryKey, searchDef.entity),
  );
  await prefetchLandingMedia({
    items: landingItems,
    maxImages: 4,
    screenKey: `search:${viewerUsername}`,
    source,
  });
}
