import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { SocialMutationResult } from "../../../data/projections/mutationPolicy";
import { applyMutationRefreshPolicy } from "../../../data/projections/mutationPolicy";
import { patchViewerRelationshipSurfaces } from "../../../data/social";
import {
  patchProfileFollowCaches,
  patchProfileRelationshipFollowStatus,
} from "./profileFollowProjectionPatches";
import { buildProfileFollowRefreshPolicy } from "./profileFollowRefreshPolicy";
import type {
  FollowState,
  ProfileRelationshipPatchTarget,
  TargetAccountType,
} from "./profileFollowMutation.shared";

type ProfileFollowMutationParams = {
  extraInvalidateKeys?: QueryKey[];
  extraStaleKeys?: QueryKey[];
  nextStatus: FollowState;
  previousStatus: FollowState;
  queryClient: QueryClient;
  relationship?: ProfileRelationshipPatchTarget;
  targetProfile?: {
    accountType?: TargetAccountType | null;
    isPrivate?: boolean | null;
  };
  username: string;
  viewerCacheKey: string;
  viewerUsername: string;
};

function applyProfileFollowMutationState(params: ProfileFollowMutationParams) {
  patchProfileFollowCaches(params);
  patchViewerRelationshipSurfaces({
    nextStatus: params.nextStatus,
    queryClient: params.queryClient,
    targetAccountType: params.targetProfile?.accountType || undefined,
    targetIsPrivate: params.targetProfile?.isPrivate,
    username: params.username,
    viewerCacheKey: params.viewerCacheKey,
    viewerUsername: params.viewerUsername,
  });
  if (params.relationship) {
    patchProfileRelationshipFollowStatus({
      nextStatus: params.nextStatus,
      queryClient: params.queryClient,
      relationship: params.relationship,
    });
  }
}

export function commitProfileFollowMutation(
  params: ProfileFollowMutationParams,
): SocialMutationResult {
  applyProfileFollowMutationState(params);

  const result: SocialMutationResult = {
    followState: {
      next: params.nextStatus,
      previous: params.previousStatus,
    },
    refreshPolicy: buildProfileFollowRefreshPolicy({
      extraInvalidateKeys: params.extraInvalidateKeys,
      extraStaleKeys: params.extraStaleKeys,
      nextStatus: params.nextStatus,
      previousStatus: params.previousStatus,
      username: params.username,
      viewerCacheKey: params.viewerCacheKey,
      viewerUsername: params.viewerUsername,
    }),
  };
  applyMutationRefreshPolicy(params.queryClient, result.refreshPolicy);
  return result;
}

export function applyOptimisticProfileFollowMutation(params: ProfileFollowMutationParams) {
  applyProfileFollowMutationState(params);
}

export function rollbackProfileFollowMutation(params: {
  previousStatus: FollowState;
  queryClient: QueryClient;
  relationship?: ProfileRelationshipPatchTarget;
  rolledBackFromStatus: FollowState;
  targetProfile?: {
    accountType?: TargetAccountType | null;
    isPrivate?: boolean | null;
  };
  username: string;
  viewerCacheKey: string;
  viewerUsername: string;
}) {
  applyProfileFollowMutationState({
    nextStatus: params.previousStatus,
    previousStatus: params.rolledBackFromStatus,
    queryClient: params.queryClient,
    relationship: params.relationship,
    targetProfile: params.targetProfile,
    username: params.username,
    viewerCacheKey: params.viewerCacheKey,
    viewerUsername: params.viewerUsername,
  });
  applyMutationRefreshPolicy(
    params.queryClient,
    buildProfileFollowRefreshPolicy({
      nextStatus: params.previousStatus,
      previousStatus: params.rolledBackFromStatus,
      username: params.username,
      viewerCacheKey: params.viewerCacheKey,
      viewerUsername: params.viewerUsername,
    }),
  );
}
