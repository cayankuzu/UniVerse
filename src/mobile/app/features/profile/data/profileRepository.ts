import type { ProjectionFetchContext } from "../../../data/projections/contracts";
import type { ProjectionEnvelope } from "../../../data/query/contracts";
import { getViewerKey } from "../../../data/contracts/viewerKey";
import type {
  ProfileContentTab,
  ProfileOverviewProjection,
  ProfileScreenProjectionResult,
  RelationshipProjectionItem,
} from "../../../data/projections/projections.types";
import type { ProjectionRequestContext } from "../../../data/projections/projections.request";
import type { AlbumPhotoWithMeta, EventWithMeta } from "../../../data/contracts/content";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import {
  CACHE_WARM_STALE_TIMES,
  INITIAL_PAGE_SIZES,
  PAGE_SIZES,
  STALE_TIMES,
} from "../../../data/projections/cacheConfig";
import {
  PROFILE_PROJECTION_POLICY,
  VIEW_PROFILE_PROJECTION_POLICY,
} from "../../../data/projections/policies/projectionPolicies";
import type { ViewerContext } from "../../../data/projections/viewerContext";
import {
  getProfileContent,
  getProfileOverview,
  getProfileScreen,
  getRelationships,
} from "./profileProjectionApi";

const INITIAL_PROFILE_CONTENT_PAGE_SIZE = INITIAL_PAGE_SIZES.profileContent;

function resolveProfileContentEntity(tab: ProfileContentTab) {
  return tab === "album" ? ("profile-albums" as const) : ("profile-events" as const);
}

export function fetchOwnProfileOverview(
  profileUsername: string,
  viewerId?: string,
): Promise<ProfileOverviewProjection> {
  return getProfileOverview(profileUsername, profileUsername, viewerId);
}

export function fetchViewProfileOverview(
  targetUsername: string,
  viewerUsername: string,
  viewerId?: string,
): Promise<ProfileOverviewProjection> {
  return getProfileOverview(targetUsername, viewerUsername, viewerId);
}

export function fetchOwnProfileContent(params: {
  cursor?: string | null;
  deltaToken?: string | null;
  limit?: number;
  since?: string | null;
  tab: ProfileContentTab;
  username: string;
  viewerId?: string;
}): Promise<ProjectionEnvelope<AlbumPhotoWithMeta | EventWithMeta>> {
  return getProfileContent(params.username, params.tab, params.viewerId, params.username, {
    cursor: params.cursor,
    deltaToken: params.deltaToken,
    limit: params.limit,
    since: params.since,
  });
}

export function fetchViewProfileContent(params: {
  context?: ProjectionRequestContext;
  tab: ProfileContentTab;
  username: string;
  viewerId?: string;
  viewerUsername?: string;
}): Promise<ProjectionEnvelope<AlbumPhotoWithMeta | EventWithMeta>> {
  return getProfileContent(
    params.username,
    params.tab,
    params.viewerId,
    params.viewerUsername,
    params.context,
  );
}

export function fetchProfileScreenBootstrap(params: {
  pageSize: number;
  tab: ProfileContentTab;
  username: string;
  viewerId?: string;
  viewerUsername: string;
}): Promise<ProfileScreenProjectionResult<AlbumPhotoWithMeta | EventWithMeta>> {
  return getProfileScreen<AlbumPhotoWithMeta | EventWithMeta>(
    params.username,
    params.viewerUsername,
    params.tab,
    params.viewerId,
    { limit: Math.min(params.pageSize, INITIAL_PROFILE_CONTENT_PAGE_SIZE) },
  );
}

export function fetchRelationships(params: {
  context?: ProjectionRequestContext;
  kind: "followers" | "following";
  username: string;
  viewerId?: string;
}): Promise<ProjectionEnvelope<RelationshipProjectionItem>> {
  return getRelationships(params.username, params.kind, params.viewerId, params.context);
}

export function getOwnProfileOverviewQueryDef(viewer: ViewerContext) {
  const viewerKey = getViewerKey(viewer);
  return {
    queryFn: () => fetchOwnProfileOverview(viewer.username, viewer.id),
    queryKey: projectionKeys.profileOverview(viewer.username, viewerKey),
    staleTime: STALE_TIMES.ownProfileOverview,
  };
}

export function getOwnProfileContentQueryDef(params: {
  tab: ProfileContentTab;
  viewer: ViewerContext;
}) {
  const viewerKey = getViewerKey(params.viewer);
  return {
    entity: resolveProfileContentEntity(params.tab),
    fetchProjection: ({ cursor, deltaToken, limit, since }: ProjectionFetchContext) =>
      fetchOwnProfileContent({
        cursor,
        deltaToken,
        limit:
          !cursor && !deltaToken && !since
            ? Math.min(limit ?? PAGE_SIZES.profileContent, INITIAL_PROFILE_CONTENT_PAGE_SIZE)
            : (limit ?? PAGE_SIZES.profileContent),
        since,
        tab: params.tab,
        username: params.viewer.username,
        viewerId: params.viewer.id,
      }),
    pageSize: PAGE_SIZES.profileContent,
    policy: PROFILE_PROJECTION_POLICY,
    queryKey: projectionKeys.profileContent(params.viewer.username, params.tab, viewerKey),
    staleTime: STALE_TIMES.ownProfileContent,
    cacheWarmStaleTime: CACHE_WARM_STALE_TIMES.ownProfileContent,
  };
}

export function getViewProfileOverviewQueryDef(params: {
  targetUsername: string;
  viewer: ViewerContext;
}) {
  const viewerKey = getViewerKey(params.viewer);
  return {
    queryFn: () =>
      fetchViewProfileOverview(params.targetUsername, params.viewer.username, params.viewer.id),
    queryKey: projectionKeys.profileOverview(params.targetUsername, viewerKey),
    staleTime: STALE_TIMES.viewProfileOverview,
  };
}

export function getViewProfileContentQueryDef(params: {
  tab: ProfileContentTab;
  targetUsername: string;
  viewer: ViewerContext;
}) {
  const viewerKey = getViewerKey(params.viewer);
  return {
    entity: resolveProfileContentEntity(params.tab),
    fetchProjection: ({ cursor, deltaToken, limit, since }: ProjectionFetchContext) =>
      fetchViewProfileContent({
        context: {
          cursor,
          deltaToken,
          limit:
            !cursor && !deltaToken && !since
              ? Math.min(limit ?? PAGE_SIZES.profileContent, INITIAL_PROFILE_CONTENT_PAGE_SIZE)
              : (limit ?? PAGE_SIZES.profileContent),
          since,
        },
        tab: params.tab,
        username: params.targetUsername,
        viewerId: params.viewer.id,
        viewerUsername: params.viewer.username,
      }),
    pageSize: PAGE_SIZES.profileContent,
    policy: VIEW_PROFILE_PROJECTION_POLICY,
    queryKey: projectionKeys.profileContent(params.targetUsername, params.tab, viewerKey),
    staleTime: STALE_TIMES.viewProfileContent,
    cacheWarmStaleTime: CACHE_WARM_STALE_TIMES.viewProfileContent,
  };
}

export function getRelationshipsQueryDef(params: {
  kind: "followers" | "following";
  username: string;
  viewer: ViewerContext;
}) {
  const viewerKey = getViewerKey(params.viewer);
  return {
    entity: "relationships" as const,
    fetchProjection: ({ cursor, deltaToken, limit, since }: ProjectionFetchContext) =>
      fetchRelationships({
        context: {
          cursor,
          deltaToken,
          limit:
            !cursor && !deltaToken && !since
              ? Math.min(limit ?? PAGE_SIZES.relationships, INITIAL_PAGE_SIZES.relationships)
              : (limit ?? PAGE_SIZES.relationships),
          since,
        },
        kind: params.kind,
        username: params.username,
        viewerId: params.viewer.id,
      }),
    pageSize: PAGE_SIZES.relationships,
    policy: PROFILE_PROJECTION_POLICY,
    queryKey: projectionKeys.relationships(params.username, params.kind, viewerKey),
    staleTime: STALE_TIMES.relationships,
    cacheWarmStaleTime: CACHE_WARM_STALE_TIMES.relationships,
  };
}

export function getProfileBootstrapQueryDef(params: {
  pageSize?: number;
  tab: ProfileContentTab;
  username: string;
  viewer: ViewerContext;
}) {
  const viewerKey = getViewerKey(params.viewer);
  return {
    queryFn: () =>
      fetchProfileScreenBootstrap({
        pageSize: params.pageSize ?? PAGE_SIZES.profileContent,
        tab: params.tab,
        username: params.username,
        viewerId: params.viewer.id,
        viewerUsername: params.viewer.username,
      }),
    queryKey: projectionKeys.profileScreen(params.username, params.tab, viewerKey),
    staleTime: STALE_TIMES.viewProfileOverview,
  };
}
