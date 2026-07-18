import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PAGE_SIZES } from "../../../data/projections/cacheConfig";
import type { ProfileContentTab } from "../../../data/projections/projections.types";
import { PROFILE_PROJECTION_POLICY } from "../../../data/projections/policies/projectionPolicies";
import { useProjectionScreen } from "../../../data/projections/screen/useProjectionScreen";
import { useScreenRefresh } from "../../../data/projections/screen/useScreenRefresh";
import { useOptimisticOutboxMetaStore } from "../../../data/queues/optimisticOutboxMeta";
import { createStableQueryOptions } from "../../../data/query/options";
import { getViewerKey } from "../../../data/contracts/viewerKey";
import { scheduleAfterInteractions } from "../../../shared/utils/scheduleAfterInteractions";
import { normalizeProfileValue } from "../domain/viewProfile.helpers";
import {
  resolveProfileLockState,
  resolveProfileContentAccess,
} from "../domain/viewProfileState.helpers";
import {
  getViewProfileContentQueryDef,
  getViewProfileOverviewQueryDef,
  type AlbumPhotoWithMeta,
  type EventWithMeta,
} from "../data";
import { useCanonicalProfileFollowState } from "./useCanonicalProfileFollowState";
import { useProfileBootstrapState } from "./useProfileBootstrapState";
import type { ProfileFollowState } from "./useProfileFollowAction";
import { useProfileProjectionContentState } from "./useProfileProjectionContentState";
import type { UseViewProfileParams } from "./viewProfile.types";

type FollowState = ProfileFollowState;
type UseViewProfileOverviewStateParams = {
  contentTab: ProfileContentTab;
  onWarningMessage?: (message: string | null) => void;
  params: UseViewProfileParams;
};

export function useViewProfileOverviewState(options: UseViewProfileOverviewStateParams) {
  const { contentTab, onWarningMessage, params } = options;
  const normalizedAccountType: "club" | "student" =
    params.accountType === "club" ? "club" : "student";
  const viewerCacheKey = getViewerKey(params.userData);
  const viewerUsername = normalizeProfileValue(params.userData.username || "");
  const optimisticOutbox = useOptimisticOutboxMetaStore.getState();
  const [optimisticFollowStatus, setOptimisticFollowStatus] = useState<FollowState | null>(null);
  const [backgroundWorkReady, setBackgroundWorkReady] = useState(false);
  useEffect(() => {
    setOptimisticFollowStatus(null);
  }, [params.username]);
  const viewer = useMemo(
    () => ({ id: params.userData.id, username: viewerUsername }),
    [params.userData.id, viewerUsername],
  );
  const overviewDef = useMemo(
    () =>
      getViewProfileOverviewQueryDef({
        targetUsername: params.username,
        viewer,
      }),
    [params.username, viewer],
  );
  const contentDef = useMemo(
    () =>
      getViewProfileContentQueryDef({
        tab: contentTab,
        targetUsername: params.username,
        viewer,
      }),
    [contentTab, params.username, viewer],
  );
  const profileBootstrap = useProfileBootstrapState({
    enabled: Boolean(params.username),
    pageSize: PAGE_SIZES.profileContent,
    policy: PROFILE_PROJECTION_POLICY,
    tab: contentTab,
    username: params.username,
    viewerId: params.userData.id,
    viewerKey: viewerCacheKey,
    viewerUsername,
  });
  const profileQuery = useQuery({
    ...createStableQueryOptions(overviewDef.staleTime),
    enabled: Boolean(params.username) && !profileBootstrap.isBootstrapping,
    placeholderData: (previousData) => previousData,
    queryFn: overviewDef.queryFn,
    queryKey: overviewDef.queryKey,
  });
  const profileErrorMessage = String(
    (profileQuery.error as { message?: string } | null)?.message || "",
  );
  const isBlockedProfile = profileErrorMessage.includes("PROFILE_BLOCKED");
  const isLockedProfile = isBlockedProfile || profileErrorMessage.includes("PROFILE_LOCKED");
  let profile = profileQuery.data?.profile;
  if (isBlockedProfile) {
    profile = undefined;
  }
  const profileIsPrivate = profile?.accountType === "club" ? false : Boolean(profile?.isPrivate);
  if (profile && profile.isPrivate !== profileIsPrivate) {
    profile = {
      ...profile,
      isPrivate: profileIsPrivate,
    };
  }
  const targetProfileId = String(profile?.id || "").trim() || null;
  const profileCapabilities = profileQuery.data?.capabilities || null;
  const isOwnProfile =
    normalizeProfileValue(profile?.username || params.username) === viewerUsername;
  const { followLabel, followMutation, followStatus, followVariant, hasAuthoritativeFollowStatus } =
    useCanonicalProfileFollowState({
      isOwnProfile,
      onWarningMessage,
      optimisticFollowStatus,
      optimisticOutbox,
      profile,
      profileCapabilities,
      profileFollowStatus: profileQuery.data?.followStatus || "none",
      profileIsPrivate,
      setOptimisticFollowStatus,
      targetProfileId,
      targetUsername: params.username,
      viewerCacheKey,
      viewerId: params.userData.id,
      viewerUsername,
    });
  const canViewContent = resolveProfileContentAccess({
    capabilityCanViewContent: Boolean(profileCapabilities?.canViewContent),
    followStatus,
    hasAuthoritativeFollowStatus,
    isOwnProfile,
    profile,
  });
  const canViewFollowers =
    Boolean(profile) && (canViewContent || Boolean(profileCapabilities?.canViewFollowers));
  const canViewFollowing =
    Boolean(profile) && (canViewContent || Boolean(profileCapabilities?.canViewFollowing));
  const shouldFetchContent =
    Boolean(profile) && canViewContent && !profileBootstrap.isBootstrapping;
  const expectedAlbumsCount = Number(profile?.albumsCount || 0);
  const expectedEventsCount = Number(profile?.eventsCount || 0);
  const activeProjection = useProjectionScreen<AlbumPhotoWithMeta | EventWithMeta>({
    ...contentDef,
    autoRefreshOnFocus: false,
    enabled: shouldFetchContent,
  });
  const profileContent = useProfileProjectionContentState({
    activeItems: activeProjection.items,
    enabled: Boolean(profile) && canViewContent,
    expectedAlbumsCount,
    expectedEventsCount,
    tab: contentTab,
    username: params.username,
    viewerId: params.userData.id || undefined,
    viewerKey: viewerCacheKey,
    viewerUsername,
  });
  const hasPrimaryProfileContent =
    Boolean(profile) &&
    (!shouldFetchContent ||
      activeProjection.hasCachedSnapshot ||
      activeProjection.items.length > 0 ||
      profileContent.sourceAlbums.length > 0 ||
      profileContent.sourceEvents.length > 0);
  useEffect(() => {
    setBackgroundWorkReady(false);
    if (!hasPrimaryProfileContent) return;
    const task = scheduleAfterInteractions(() => {
      setBackgroundWorkReady(true);
    }, 96);
    return () => task.cancel();
  }, [contentTab, hasPrimaryProfileContent, params.username]);
  const onRefresh = useScreenRefresh({
    maxParallel: 2,
    screenKey: `view-profile:${viewerCacheKey}:${params.username}:${contentTab}`,
    surface: "view-profile",
    tasks: [
      {
        bestEffort: canViewContent,
        id: "profile-overview",
        lane: canViewContent ? "background" : "critical",
        run: () => profileQuery.refetch(),
      },
      {
        bestEffort: !canViewContent,
        id: "profile-content",
        run: () => (shouldFetchContent ? activeProjection.onRefresh() : undefined),
      },
    ],
  });
  const { contentLockedMessage, showPrivateNotice, privateNoticeText } = resolveProfileLockState({
    canViewContent,
    isOwnProfile,
    profile,
    lockedReasonText: profileCapabilities?.lockedReasonText,
  });
  const displayName = profile
    ? profile.accountType === "club"
      ? profile.clubName || profile.username
      : profile.name || profile.username
    : params.username;
  const profileLoading = profileBootstrap.isBootstrapping || profileQuery.isLoading;
  const refreshing =
    profileBootstrap.isBootstrapping ||
    (shouldFetchContent ? activeProjection.refreshing : Boolean(profileQuery.isFetching));
  const loadingMore = shouldFetchContent ? activeProjection.loadingMore : false;

  return {
    backgroundWorkReady,
    normalizedAccountType,
    screenData: {
      activeProjection,
      canViewContent,
      canViewFollowers,
      canViewFollowing,
      contentLockedMessage,
      displayName,
      followLabel,
      followMutation,
      followStatus,
      followVariant,
      isLockedProfile,
      isOwnProfile,
      loadingMore,
      onRefresh,
      privateNoticeText,
      profile,
      profileCapabilities,
      profileLoading,
      profileQuery,
      refreshing,
      showPrivateNotice,
      sourceAlbums: profileContent.sourceAlbums,
      sourceEvents: profileContent.sourceEvents,
    },
    viewerCacheKey,
    viewerUsername,
  };
}
