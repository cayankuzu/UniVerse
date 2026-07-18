import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import { applyMutationRefreshPolicy } from "../../../data/projections/mutationPolicy";
import { applyEntityPatches } from "../../../data/projections/patchEnvelope";
import type { FollowState, ProfileRelationshipPatchTarget } from "./profileFollowMutation.shared";

function clampCount(value: number) {
  return Math.max(0, value);
}

function toFollowingDelta(previousStatus: FollowState, nextStatus: FollowState) {
  const wasFollowing = previousStatus === "following";
  const isFollowing = nextStatus === "following";
  if (wasFollowing === isFollowing) return 0;
  return isFollowing ? 1 : -1;
}

function removeProjectionId(queryClient: QueryClient, queryKey: QueryKey, id: string) {
  queryClient.setQueryData(queryKey, (current: unknown) => {
    if (!current || typeof current !== "object") return current;
    const row = current as { ids?: string[] };
    if (!Array.isArray(row.ids)) return current;
    return {
      ...row,
      ids: row.ids.filter((item) => item !== id),
      touchedAt: Date.now(),
    };
  });
}

export function patchProfileFollowCaches(params: {
  nextStatus: FollowState;
  previousStatus: FollowState;
  queryClient: QueryClient;
  username: string;
  viewerCacheKey: string;
  viewerUsername: string;
}) {
  const delta = toFollowingDelta(params.previousStatus, params.nextStatus);
  params.queryClient.setQueryData(
    projectionKeys.profileOverview(params.username, params.viewerCacheKey),
    (current: unknown) => {
      if (!current || typeof current !== "object") return current;
      const row = current as { followStatus?: string; profile?: Record<string, unknown> };
      if (!row.profile) return current;
      return {
        ...row,
        followStatus: params.nextStatus,
        profile: {
          ...row.profile,
          followersCount: clampCount(Number(row.profile.followersCount || 0) + delta),
        },
      };
    },
  );
  params.queryClient.setQueryData(
    projectionKeys.profileOverview(params.viewerUsername, params.viewerCacheKey),
    (current: unknown) => {
      if (!current || typeof current !== "object") return current;
      const row = current as { profile?: Record<string, unknown> };
      if (!row.profile) return current;
      return {
        ...row,
        profile: {
          ...row.profile,
          followingCount: clampCount(Number(row.profile.followingCount || 0) + delta),
        },
      };
    },
  );
}

export function patchProfileRelationshipFollowStatus(params: {
  nextStatus: FollowState;
  queryClient: QueryClient;
  relationship: ProfileRelationshipPatchTarget;
}) {
  applyEntityPatches(params.queryClient, [
    {
      changes: { viewerFollowStatus: params.nextStatus },
      entity: "relationships",
      id: params.relationship.id,
    },
  ]);

  if (params.relationship.removeOnNone && params.nextStatus === "none") {
    removeProjectionId(params.queryClient, params.relationship.listKey, params.relationship.id);
    return;
  }

  applyMutationRefreshPolicy(params.queryClient, {
    touchKeys: [params.relationship.listKey],
  });
}
