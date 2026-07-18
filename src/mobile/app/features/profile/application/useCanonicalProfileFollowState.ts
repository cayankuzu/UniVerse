import { useQuery } from "@tanstack/react-query";
import { createStableQueryOptions } from "../../../data/query/options";
import { getViewerRelationshipSnapshot } from "../../../data/social";
import { getViewerRelationshipSnapshotQueryKey } from "../../../data/social/relationshipSnapshot";
import { getFollowLabel, getFollowVariant } from "../domain/viewProfile.helpers";
import {
  normalizeDisplayProfileFollowStatus,
  resolveEffectiveProfileFollowStatus,
  resolveProfileFollowStatus,
  resolveRelationshipBackedProfileFollowStatus,
} from "../domain/viewProfileState.helpers";
import { type ProfileFollowState, useProfileFollowAction } from "./useProfileFollowAction";

type FollowState = ProfileFollowState;

export function useCanonicalProfileFollowState(params: {
  isOwnProfile: boolean;
  onWarningMessage?: (message: string | null) => void;
  optimisticFollowStatus: FollowState | null;
  optimisticOutbox: {
    begin: (params: { action: string; entity: string; id: string }) => void;
    fail: (id: string, reason: string) => void;
    resolve: (id: string) => void;
  };
  profile:
    | {
        accountType?: "club" | "student";
        isPrivate?: boolean;
      }
    | null
    | undefined;
  profileCapabilities:
    | {
        canViewContent?: boolean | null;
      }
    | null
    | undefined;
  profileFollowStatus?: FollowState | null;
  profileIsPrivate: boolean;
  setOptimisticFollowStatus: (status: FollowState | null) => void;
  targetProfileId?: string | null;
  targetUsername: string;
  viewerCacheKey: string;
  viewerId?: string;
  viewerUsername: string;
}) {
  const relationshipSnapshotQuery = useQuery({
    ...createStableQueryOptions(120_000),
    enabled: Boolean(params.targetUsername) && Boolean(params.viewerId || params.viewerUsername),
    gcTime: 30 * 60_000,
    placeholderData: (previousData) => previousData,
    queryFn: () =>
      getViewerRelationshipSnapshot({
        viewerId: params.viewerId,
        viewerUsername: params.viewerUsername,
      }),
    queryKey: getViewerRelationshipSnapshotQueryKey({
      viewerId: params.viewerId,
      viewerUsername: params.viewerUsername,
    }),
  });

  const snapshotBackedFollowStatus = resolveRelationshipBackedProfileFollowStatus({
    followStatusFromProjection: params.profileFollowStatus || "none",
    relationshipSnapshot: relationshipSnapshotQuery.data,
    targetUsername: params.targetUsername,
  });
  const hasAuthoritativeFollowStatus = relationshipSnapshotQuery.isSuccess;
  const allowCapabilityBackedFollowState =
    !hasAuthoritativeFollowStatus || snapshotBackedFollowStatus === "following";
  const rawFollowStatus = resolveProfileFollowStatus({
    followStatusFromProjection: params.profileFollowStatus || "none",
    followStatusFromDirect: snapshotBackedFollowStatus,
    optimisticFollowStatus: params.optimisticFollowStatus,
  });
  const followStatus = resolveEffectiveProfileFollowStatus({
    allowCapabilityOverride: allowCapabilityBackedFollowState,
    capabilityCanViewContent: Boolean(params.profileCapabilities?.canViewContent),
    followStatus: normalizeDisplayProfileFollowStatus({
      accountType: params.profile?.accountType,
      followStatus: rawFollowStatus,
    }),
    isOwnProfile: params.isOwnProfile,
    profile: params.profile,
  });

  const setNormalizedOptimisticFollowStatus = (status: FollowState) => {
    params.setOptimisticFollowStatus(
      normalizeDisplayProfileFollowStatus({
        accountType: params.profile?.accountType,
        followStatus: status,
      }),
    );
  };

  const followMutation = useProfileFollowAction({
    currentStatus: followStatus,
    ownerId: String(params.viewerId || ""),
    onError: ({ previousStatus }) => {
      setNormalizedOptimisticFollowStatus(previousStatus);
      params.onWarningMessage?.("Takip durumu güncellenemedi.");
    },
    onMutateStatus: setNormalizedOptimisticFollowStatus,
    onSuccessStatus: setNormalizedOptimisticFollowStatus,
    optimisticOutbox: {
      action: "follow-toggle",
      begin: params.optimisticOutbox.begin,
      entity: "profile-overview",
      fail: params.optimisticOutbox.fail,
      failReason: "follow-toggle-failed",
      id: `follow:${params.targetUsername}`,
      resolve: params.optimisticOutbox.resolve,
    },
    targetProfile: {
      accountType: params.profile?.accountType,
      isPrivate: params.profileIsPrivate,
    },
    targetUserId: params.targetProfileId,
    username: params.targetUsername,
    viewerCacheKey: params.viewerCacheKey,
    viewerUsername: params.viewerUsername,
  });

  return {
    followLabel: getFollowLabel(followStatus, params.profileIsPrivate),
    followMutation,
    followStatus,
    followVariant: getFollowVariant(followStatus),
    hasAuthoritativeFollowStatus,
  };
}
