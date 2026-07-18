import { useCallback, useMemo } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import { replaceProjectionScope } from "../../../data/projections/projectionRefresh";
import { createClientMutationId } from "../../../data/mutations/clientMutation";
import { applyBlockedClientIsolation } from "../../../data/social";
import { useProfileFollowAction } from "./useProfileFollowAction";
import { useProfileMutationState } from "./useProfileMutationState";
import {
  buildViewProfileBlockRefreshKeys,
  buildViewProfileFollowActionPlan,
  resolveViewProfileContentWarning,
  resolveViewProfileListAccess,
} from "./viewProfileScreenHelpers";
import type { UseViewProfileParams } from "./viewProfile.types";

type UseProfileRelationshipActionsParams = {
  canViewContent: boolean;
  canViewFollowers: boolean;
  canViewFollowing: boolean;
  contentLockedMessage: string | null;
  followMutation: ReturnType<typeof useProfileFollowAction>;
  followStatus: "none" | "requested" | "following";
  mutationState: ReturnType<typeof useProfileMutationState>;
  params: UseViewProfileParams;
  profile:
    | {
        accountType?: "club" | "student";
        id?: string;
        isPrivate?: boolean;
      }
    | null
    | undefined;
  profileCapabilities: {
    lockedReasonCode?: string | null;
    lockedReasonText?: string | null;
  } | null;
  queryClient: QueryClient;
  viewerCacheKey: string;
  viewerUsername: string;
};

function patchBlockedOverviewState(params: {
  queryClient: QueryClient;
  targetUsername: string;
  viewerCacheKey: string;
}) {
  params.queryClient.setQueryData(
    projectionKeys.profileOverview(params.targetUsername, params.viewerCacheKey),
    (current: unknown) => {
      if (!current || typeof current !== "object") return current;
      const row = current as {
        capabilities?: Record<string, unknown>;
        followStatus?: string;
        profile?: Record<string, unknown>;
      };
      if (!row.profile) return current;
      return {
        ...row,
        capabilities: {
          ...row.capabilities,
          canViewContent: false,
          canViewFollowers: false,
          canViewFollowing: false,
          lockedReasonCode: "BLOCKED_BY_VIEWER",
          lockedReasonText: "Bu kullanıcıyı engellediniz.",
        },
        followStatus: "none",
      };
    },
  );
}

function patchUnblockedOverviewState(params: {
  accountType?: "club" | "student";
  isPrivate?: boolean;
  queryClient: QueryClient;
  targetUsername: string;
  viewerCacheKey: string;
}) {
  const canViewContent = params.accountType === "club" || !params.isPrivate;
  const lockedReasonText = canViewContent ? null : "Bu kullanıcının hesabı gizli.";

  params.queryClient.setQueryData(
    projectionKeys.profileOverview(params.targetUsername, params.viewerCacheKey),
    (current: unknown) => {
      if (!current || typeof current !== "object") return current;
      const row = current as {
        capabilities?: Record<string, unknown>;
        followStatus?: string;
        profile?: Record<string, unknown>;
      };
      if (!row.profile) return current;
      return {
        ...row,
        capabilities: {
          ...row.capabilities,
          canViewContent,
          canViewFollowers: canViewContent,
          canViewFollowing: canViewContent,
          lockedReasonCode: canViewContent ? null : "PRIVATE_PROFILE",
          lockedReasonText,
        },
        followStatus: "none",
      };
    },
  );
}

export function useProfileRelationshipActions(params: UseProfileRelationshipActionsParams) {
  const { isRelationshipPending, relationshipError, runMutation } = params.mutationState;
  const userIsBlockedByCapability =
    params.profileCapabilities?.lockedReasonCode === "BLOCKED_BY_VIEWER";
  const followActionPlan = useMemo(
    () =>
      buildViewProfileFollowActionPlan({
        currentStatus: params.followStatus,
        profile: params.profile,
      }),
    [params.followStatus, params.profile],
  );
  const runBlockToggle = useCallback(
    async (currentlyBlocked: boolean) => {
      if (!params.params.username) return;
      const refreshKeys = buildViewProfileBlockRefreshKeys({
        username: params.params.username,
        viewerCacheKey: params.viewerCacheKey,
        viewerUsername: params.viewerUsername,
      });
      const applyOptimisticPatch = () => {
        if (currentlyBlocked) {
          patchUnblockedOverviewState({
            accountType: params.profile?.accountType,
            isPrivate: params.profile?.isPrivate,
            queryClient: params.queryClient,
            targetUsername: params.params.username,
            viewerCacheKey: params.viewerCacheKey,
          });
          return;
        }
        patchBlockedOverviewState({
          queryClient: params.queryClient,
          targetUsername: params.params.username,
          viewerCacheKey: params.viewerCacheKey,
        });
      };
      const rollbackPatch = () => {
        if (currentlyBlocked) {
          patchBlockedOverviewState({
            queryClient: params.queryClient,
            targetUsername: params.params.username,
            viewerCacheKey: params.viewerCacheKey,
          });
          return;
        }
        patchUnblockedOverviewState({
          accountType: params.profile?.accountType,
          isPrivate: params.profile?.isPrivate,
          queryClient: params.queryClient,
          targetUsername: params.params.username,
          viewerCacheKey: params.viewerCacheKey,
        });
      };

      applyOptimisticPatch();

      return runMutation({
        execute: async () => {
          if (currentlyBlocked) {
            await params.params.unblockUser(params.params.username, {
              targetUserId: params.profile?.id,
            });
          } else {
            await params.params.blockUser(params.params.username, {
              targetUserId: params.profile?.id,
            });
          }
          await applyBlockedClientIsolation({
            isBlocked: !currentlyBlocked,
            queryClient: params.queryClient,
            targetAccountType: params.profile?.accountType,
            targetUserId: params.profile?.id,
            targetUsername: params.params.username,
            viewerCacheKey: params.viewerCacheKey,
            viewerUsername: params.viewerUsername,
          });
          refreshKeys.forEach((key) => replaceProjectionScope(params.queryClient, key));
        },
        kind: "relationship",
        rollback: () => {
          rollbackPatch();
          refreshKeys.forEach((key) => replaceProjectionScope(params.queryClient, key));
        },
      });
    },
    [
      params.params,
      params.profile?.accountType,
      params.profile?.id,
      params.profile?.isPrivate,
      params.queryClient,
      runMutation,
      params.viewerCacheKey,
      params.viewerUsername,
    ],
  );
  const followAction = useMemo(
    () => ({
      confirmation: followActionPlan.confirmation,
      run: () =>
        params.followMutation.mutate({
          clientMutationId: createClientMutationId("follow-toggle"),
          targetStatus: followActionPlan.targetStatus,
        }),
      targetStatus: followActionPlan.targetStatus,
    }),
    [followActionPlan, params.followMutation],
  );
  const followersAccess = useMemo(
    () =>
      resolveViewProfileListAccess({
        canViewList: params.canViewFollowers,
        fallbackMessage: "Takipçi listesi bu kullanıcı için sınırlı.",
        lockedReasonText: params.profileCapabilities?.lockedReasonText,
      }),
    [params.canViewFollowers, params.profileCapabilities?.lockedReasonText],
  );
  const followingAccess = useMemo(
    () =>
      resolveViewProfileListAccess({
        canViewList: params.canViewFollowing,
        fallbackMessage: "Takip listesi bu kullanıcı için sınırlı.",
        lockedReasonText: params.profileCapabilities?.lockedReasonText,
      }),
    [params.canViewFollowing, params.profileCapabilities?.lockedReasonText],
  );
  const contentWarningMessage = useMemo(
    () =>
      params.canViewContent
        ? null
        : resolveViewProfileContentWarning({
            contentLockedMessage: params.contentLockedMessage,
            lockedReasonText: params.profileCapabilities?.lockedReasonText,
          }),
    [
      params.canViewContent,
      params.contentLockedMessage,
      params.profileCapabilities?.lockedReasonText,
    ],
  );

  return {
    contentWarningMessage,
    followersAccess,
    followAction,
    followingAccess,
    isRelationshipPending,
    relationshipError,
    runBlockToggle,
    userIsBlocked:
      userIsBlockedByCapability ||
      (Boolean(params.params.username) && params.params.isBlocked(params.params.username)),
  };
}
