/**
 * Search Repository — Single source of truth for search data.
 *
 * DATA LAYER: Owns all search result queries and discovery data.
 *
 * Flow: ProjectionAPI → searchRepository → ViewModel (useSearchResults) → UI
 */
import type { ProjectionFetchContext } from "../../../data/projections/contracts";
import type { ProjectionEnvelope } from "../../../data/query/contracts";
import { getViewerKey } from "../../../data/contracts/viewerKey";
import type {
  SearchProjectionItem,
  SearchProjectionParams,
} from "../../../data/projections/projections.types";
import type { ProjectionRequestContext } from "../../../data/projections/projections.request";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import {
  STALE_TIMES,
  CACHE_WARM_STALE_TIMES,
  INITIAL_PAGE_SIZES,
  PAGE_SIZES,
} from "../../../data/projections/cacheConfig";
import { SEARCH_PROJECTION_POLICY } from "../../../data/projections/policies/projectionPolicies";
import type { ViewerContext } from "../../../data/projections/viewerContext";
import { SEARCH_DISCOVERY_SCOPE } from "./searchConstants";
import { getSearchResults } from "./searchProjectionApi";

const INITIAL_SEARCH_PAGE_SIZE = INITIAL_PAGE_SIZES.search;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveSearchEntity(kind: SearchProjectionParams["kind"]) {
  return kind === "events"
    ? ("search-events" as const)
    : kind === "albums"
      ? ("search-albums" as const)
      : ("search-users" as const);
}

function resolveSearchQueryHash(params: {
  categoryFilter?: string;
  feeFilter?: SearchProjectionParams["feeFilter"];
  kind: SearchProjectionParams["kind"];
  queryText?: string;
  sortMode?: string;
  universityFilter?: string;
}) {
  const sortMode = params.sortMode || "newest";
  const hasSearchIntent = Boolean(
    params.queryText ||
    params.categoryFilter ||
    params.universityFilter ||
    params.feeFilter ||
    sortMode !== "newest",
  );
  if (!hasSearchIntent) {
    return SEARCH_DISCOVERY_SCOPE;
  }
  return [
    params.kind,
    params.queryText || "",
    params.categoryFilter || "",
    params.feeFilter || "",
    sortMode,
    params.universityFilter || "",
  ].join(":");
}

// ─── Fetch Functions ────────────────────────────────────────────────────────

export function fetchSearchResults(
  params: SearchProjectionParams,
  context: ProjectionRequestContext = {},
): Promise<ProjectionEnvelope<SearchProjectionItem>> {
  return getSearchResults(params, context);
}

// ─── Query Definitions ──────────────────────────────────────────────────────

export function getSearchQueryDef(params: {
  categoryFilter?: string;
  feeFilter?: SearchProjectionParams["feeFilter"];
  kind: SearchProjectionParams["kind"];
  queryText?: string;
  sortMode?: string;
  universityFilter?: string;
  viewer: ViewerContext;
}) {
  const viewerKey = getViewerKey(params.viewer);
  const queryHash = resolveSearchQueryHash(params);

  return {
    entity: resolveSearchEntity(params.kind),
    fetchProjection: ({ cursor, deltaToken, limit, since }: ProjectionFetchContext) =>
      fetchSearchResults(
        {
          categoryFilter: params.categoryFilter,
          feeFilter: params.feeFilter,
          kind: params.kind,
          limit:
            !cursor && !deltaToken && !since
              ? Math.min(limit ?? PAGE_SIZES.search, INITIAL_SEARCH_PAGE_SIZE)
              : (limit ?? PAGE_SIZES.search),
          queryText: params.queryText,
          sortMode: params.sortMode,
          universityFilter: params.universityFilter,
          viewerId: params.viewer.id,
          viewerUsername: params.viewer.username,
        },
        { cursor, deltaToken, since },
      ),
    pageSize: PAGE_SIZES.search,
    policy: SEARCH_PROJECTION_POLICY,
    queryKey: projectionKeys.search(params.kind, viewerKey, queryHash),
    staleTime: STALE_TIMES.search,
    cacheWarmStaleTime: CACHE_WARM_STALE_TIMES.search,
  };
}
