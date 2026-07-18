import type { QueryKey } from "@tanstack/react-query";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import type { MutationRefreshPolicy } from "../../../data/projections/mutationPolicy";
import {
  getProfileContentProjectionKeys,
  getProfileRelationshipProjectionKeys,
} from "../../../data/profile/profileProjectionKeys";
import { getViewerRelationshipSnapshotQueryKey } from "../../../data/social/relationshipSnapshot";
import type { FollowState } from "./profileFollowMutation.shared";

export function buildProfileFollowRefreshPolicy(params: {
  extraInvalidateKeys?: QueryKey[];
  extraStaleKeys?: QueryKey[];
  nextStatus: FollowState;
  previousStatus: FollowState;
  username: string;
  viewerCacheKey: string;
  viewerUsername: string;
}): MutationRefreshPolicy {
  const {
    extraInvalidateKeys = [],
    extraStaleKeys = [],
    nextStatus,
    previousStatus,
    username,
    viewerCacheKey,
    viewerUsername,
  } = params;
  const searchKeys = [
    projectionKeys.screen("search", "events", viewerCacheKey),
    projectionKeys.screen("search", "albums", viewerCacheKey),
    projectionKeys.screen("search", "clubs", viewerCacheKey),
    projectionKeys.screen("search", "students", viewerCacheKey),
  ];
  const shouldResetSearchScopes = nextStatus === "none" && previousStatus !== "none";

  return {
    replaceKeys: [projectionKeys.screen("home", viewerCacheKey)],
    refreshKeys: [
      projectionKeys.profileOverview(username, viewerCacheKey),
      ...getProfileRelationshipProjectionKeys(username, viewerCacheKey),
      ...getProfileContentProjectionKeys(username, viewerCacheKey),
    ],
    staleKeys: [
      projectionKeys.profileOverview(viewerUsername, viewerCacheKey),
      ...(shouldResetSearchScopes ? [] : searchKeys),
      ...extraStaleKeys,
    ],
    resetKeys: shouldResetSearchScopes ? searchKeys : undefined,
    invalidateKeys: [
      getViewerRelationshipSnapshotQueryKey({
        viewerId: viewerCacheKey,
        viewerUsername,
      }),
      ...extraInvalidateKeys,
    ],
    touchKeys: [
      projectionKeys.profileOverview(viewerUsername, viewerCacheKey),
      ...getProfileRelationshipProjectionKeys(viewerUsername, viewerCacheKey),
    ],
  };
}
