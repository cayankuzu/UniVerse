import { useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWindowDimensions } from "react-native";
import type { ProfileContentTab } from "../../../data/projections/projections.types";
import { useContentIntentPrefetch } from "../../../data/projections/prefetch/useContentIntentPrefetch";
import { useViewerRelations } from "../../../data/social";
import { debugLog } from "../../../platform/logging/logger";
import { useBottomNavPadding } from "../../../shared/layout/bottomNavSpacing";
import type { ProfileTab } from "../domain/profileConstants";
import { useProfileCollectionsState } from "./useProfileCollectionsState";
import { useProfileGridLayout } from "./useProfileGridLayout";
import { useProfileMutationState } from "./useProfileMutationState";
import { useProfileRelationshipActions } from "./useProfileRelationshipActions";
import { useProfileReportActions } from "./useProfileReportActions";
import { useProfileExperiencePrefetch, useProfileViewportPrefetch } from "./profilePrefetch";
import { useViewProfileUiState } from "./useViewProfileUiState";
import { useViewProfileOverviewState } from "./useViewProfileOverviewState";
import type { UseViewProfileOptions, UseViewProfileParams } from "./viewProfile.types";

export function useViewProfile(params: UseViewProfileParams, options: UseViewProfileOptions = {}) {
  const bottomPadding = useBottomNavPadding();
  const { width, height } = useWindowDimensions();
  const queryClient = useQueryClient();
  const viewState = useViewProfileUiState(params.username);
  const profileTab = viewState.tab as ProfileTab;
  const mutationState = useProfileMutationState();
  const { backgroundWorkReady, normalizedAccountType, screenData, viewerCacheKey, viewerUsername } =
    useViewProfileOverviewState({
      contentTab: viewState.tab as ProfileContentTab,
      onWarningMessage: options.onWarningMessage,
      params,
    });
  const { buildRelationByClub, refetch: refetchViewerRelations } = useViewerRelations({
    blockedUsers: params.blockedUsers,
    enabled:
      backgroundWorkReady &&
      Boolean(screenData.profile) &&
      (screenData.sourceAlbums.length > 0 || screenData.sourceEvents.length > 0),
    viewerId: params.userData.id,
    viewerUsername: params.userData.username,
  });
  const refreshProfileProjection = screenData.onRefresh;
  const onRefresh = useCallback(async () => {
    await Promise.all([refreshProfileProjection(), refetchViewerRelations()]);
  }, [refetchViewerRelations, refreshProfileProjection]);
  const collectionState = useProfileCollectionsState({
    albumOwnerFilter: viewState.albumOwnerFilter,
    blockedUsers: params.blockedUsers || [],
    buildRelationByClub,
    profile: screenData.profile,
    profileOwnerId: String(screenData.profile?.id || ""),
    projectionFetching:
      screenData.albumProjection.query.isFetching || screenData.eventProjection.query.isFetching,
    refreshing: screenData.refreshing,
    sourceAlbums: screenData.sourceAlbums || [],
    sourceEvents: screenData.sourceEvents || [],
    tab: viewState.tab,
    username: params.username,
    viewerUsername: params.userData.username,
  });
  const gridLayout = useProfileGridLayout({
    height,
    insetBottom: bottomPadding,
    width,
  });
  const collections = {
    ...collectionState,
    ...gridLayout,
  };
  const relationshipActions = useProfileRelationshipActions({
    canViewContent: screenData.canViewContent,
    canViewFollowers: screenData.canViewFollowers,
    canViewFollowing: screenData.canViewFollowing,
    contentLockedMessage: screenData.contentLockedMessage,
    followMutation: screenData.followMutation,
    followStatus: screenData.followStatus,
    mutationState,
    params,
    profile: screenData.profile,
    profileCapabilities: screenData.profileCapabilities,
    queryClient,
    viewerCacheKey,
    viewerUsername,
  });
  const reportActions = useProfileReportActions({
    mutationState,
    username: params.username,
  });
  const disableProfilePrefetch =
    !screenData.canViewContent ||
    !backgroundWorkReady ||
    screenData.refreshing ||
    screenData.albumProjection.query.isFetching ||
    screenData.eventProjection.query.isFetching ||
    screenData.loadingMore ||
    screenData.profileQuery.isFetching;
  const viewportPrefetch = useProfileViewportPrefetch({
    disabled: disableProfilePrefetch,
    scopeKey: `${params.username}:${viewState.tab}`,
    tab: profileTab,
    viewerKey: viewerCacheKey,
    viewerUserId: params.userData.id,
    viewerUsername,
  });
  useProfileExperiencePrefetch({
    albums: collections.albums,
    disabled: disableProfilePrefetch,
    events: collections.events,
    imageScopeKey: `${params.username}:${viewState.tab}:top-fold`,
    queryClient,
    screenKey: `view-profile:${viewerCacheKey}:${params.username}:${viewState.tab}:intent`,
    tab: profileTab,
    viewerId: params.userData.id,
    viewerKey: viewerCacheKey,
    viewerUsername,
  });
  const { prefetchEventById, prefetchProfileByUsername } = useContentIntentPrefetch({
    id: params.userData.id,
    username: params.userData.username,
  });
  useEffect(() => {
    debugLog("PROFILE/VIEW", "counts", {
      username: params.username,
      isOwnProfile: screenData.isOwnProfile,
      canViewContent: screenData.canViewContent,
      canViewFollowers: screenData.canViewFollowers,
      canViewFollowing: screenData.canViewFollowing,
      events: collections.events.length,
      albums: collections.albums.length,
      tab: viewState.tab,
      followStatus: screenData.followStatus,
    });
  }, [
    collections.albums.length,
    collections.events.length,
    params.username,
    screenData.canViewContent,
    screenData.canViewFollowers,
    screenData.canViewFollowing,
    screenData.followStatus,
    screenData.isOwnProfile,
    viewState.tab,
  ]);

  return {
    accountType: normalizedAccountType,
    albumOwnerFilter: viewState.albumOwnerFilter,
    albumOwnerFilterExpanded: viewState.albumOwnerFilterExpanded,
    albumRelationByClub: collections.albumRelationByClub,
    albums: collections.albums,
    albumsQuery: screenData.albumProjection.query,
    canViewContent: screenData.canViewContent,
    canViewFollowers: screenData.canViewFollowers,
    canViewFollowing: screenData.canViewFollowing,
    contentLockedMessage: screenData.contentLockedMessage,
    contentWarningMessage: relationshipActions.contentWarningMessage,
    displayName: screenData.displayName,
    emptyText: collections.emptyText,
    eventRelationByClub: collections.eventRelationByClub,
    events: collections.events,
    eventsQuery: screenData.eventProjection.query,
    followersAccess: relationshipActions.followersAccess,
    followAction: relationshipActions.followAction,
    followLabel: screenData.followLabel,
    followMutation: screenData.followMutation,
    followVariant: screenData.followVariant,
    followingAccess: relationshipActions.followingAccess,
    grid: collections.grid,
    isClub: collections.isClub,
    isLockedProfile: screenData.isLockedProfile,
    isOwnProfile: screenData.isOwnProfile,
    isRelationshipPending: relationshipActions.isRelationshipPending,
    isReportPending: reportActions.isReportPending,
    isTargetBlocked: relationshipActions.userIsBlocked,
    hasMore: screenData.activeProjection.hasMore,
    loadMore: screenData.activeProjection.loadMore,
    loadingMore: screenData.loadingMore,
    numColumns: collections.numColumns,
    onRefresh,
    privateNoticeText: screenData.privateNoticeText,
    profile: screenData.profile,
    profileLoading: screenData.profileLoading,
    profileQuery: screenData.profileQuery,
    refreshing: screenData.refreshing,
    relationshipError: relationshipActions.relationshipError,
    runBlockToggle: relationshipActions.runBlockToggle,
    runReport: reportActions.runReport,
    setAlbumOwnerFilter: viewState.setAlbumOwnerFilter,
    setAlbumOwnerFilterExpanded: viewState.setAlbumOwnerFilterExpanded,
    setTab: viewState.setTab,
    showPrivateNotice: screenData.showPrivateNotice,
    tab: viewState.tab,
    tabs: collections.tabs,
    tileData: collections.tileData,
    userData: params.userData,
    userIsBlocked: relationshipActions.userIsBlocked,
    viewportPrefetch,
    prefetchEventById,
    prefetchProfileByUsername,
  };
}
