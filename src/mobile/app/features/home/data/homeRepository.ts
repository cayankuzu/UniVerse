/**
 * Home Repository — Single source of truth for home feed data.
 *
 * DATA LAYER: This repository owns all home feed and notification badge data.
 * UI hooks (ViewModels) must use this repository instead of calling APIs directly.
 *
 * Flow: ProjectionAPI → homeRepository → ViewModel (useHomeScreenState) → UI
 */
import type { ProjectionFetchContext } from "../../../data/projections/contracts";
import type { ProjectionEnvelope } from "../../../data/query/contracts";
import type {
  HomeProjectionParams,
  ProjectionHomeFeedItem,
} from "../../../data/projections/projections.types";
import type { ProjectionRequestContext } from "../../../data/projections/projections.request";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import {
  STALE_TIMES,
  CACHE_WARM_STALE_TIMES,
  INITIAL_PAGE_SIZES,
  PAGE_SIZES,
} from "../../../data/projections/cacheConfig";
import { HOME_PROJECTION_POLICY } from "../../../data/projections/policies/projectionPolicies";
import type { ViewerContext } from "../../../data/projections/viewerContext";
import { getHomeFeed } from "./homeProjectionApi";

export const HOME_FEED_ENTITY = "home-feed" as const;

// ─── Fetch Functions (called by projection queries) ─────────────────────────

export function fetchHomeFeed(
  params: HomeProjectionParams,
  context: ProjectionRequestContext = {},
): Promise<ProjectionEnvelope<ProjectionHomeFeedItem>> {
  return getHomeFeed(params, context);
}

// ─── Query Definitions (consumed by ViewModels) ─────────────────────────────

export function getHomeFeedQueryDef(params: {
  blockedUsernames?: string[];
  entityFilter: string;
  sortOption: string;
  sourceFilter: string;
  typeFilter: string;
  viewer: ViewerContext;
}) {
  const viewerKey =
    String(params.viewer.id || params.viewer.username || "guest")
      .trim()
      .toLowerCase() || "guest";
  const filterScope = `${params.sourceFilter}:${params.typeFilter}:${params.entityFilter}:${params.sortOption}`;

  return {
    entity: HOME_FEED_ENTITY,
    fetchProjection: ({ cursor, deltaToken, limit, since }: ProjectionFetchContext) =>
      fetchHomeFeed(
        {
          blockedUsernames: params.blockedUsernames,
          entityFilter: params.entityFilter as HomeProjectionParams["entityFilter"],
          sortOption: params.sortOption as HomeProjectionParams["sortOption"],
          sourceFilter: params.sourceFilter as HomeProjectionParams["sourceFilter"],
          typeFilter: params.typeFilter as HomeProjectionParams["typeFilter"],
          viewerAccountType: params.viewer.accountType,
          viewerId: params.viewer.id,
          viewerUsername: params.viewer.username,
        },
        {
          cursor,
          deltaToken,
          limit:
            !cursor && !deltaToken && !since
              ? Math.min(limit ?? PAGE_SIZES.homeFeed, INITIAL_PAGE_SIZES.homeFeed)
              : (limit ?? PAGE_SIZES.homeFeed),
          since,
        },
      ),
    pageSize: PAGE_SIZES.homeFeed,
    policy: HOME_PROJECTION_POLICY,
    queryKey: projectionKeys.home(viewerKey, filterScope),
    staleTime: STALE_TIMES.homeFeed,
    cacheWarmStaleTime: CACHE_WARM_STALE_TIMES.homeFeed,
    viewerKey,
    filterScope,
  };
}

// ─── Cache Helpers ──────────────────────────────────────────────────────────

export { projectionKeys };
