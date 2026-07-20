import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWindowDimensions } from "react-native";
import { getViewerKey } from "../../../data/contracts/viewerKey";
import type { ProfileContentTab } from "../../../data/projections/projections.types";
import { useBottomNavPadding } from "../../../shared/layout/bottomNavSpacing";
import { useScrollToTopOnReselect } from "../../../shared/hooks/useScrollToTopOnReselect";
import { useContentIntentPrefetch } from "../../../data/projections/prefetch/useContentIntentPrefetch";
import { useViewerRelations } from "../../../data/social";
import { mapAppDataErrorMessage } from "../../../data/errors/appDataError";
import { t } from "../../../shared/i18n";
import { createBlockedProfileSetExcludingSelf } from "./profileCollections";
import type { ProfileTab } from "../domain/profileConstants";
import { normalizeProfileValue } from "../domain/viewProfile.helpers";
import { useProfileCollectionsState } from "./useProfileCollectionsState";
import { useProfileGridLayout } from "./useProfileGridLayout";
import { useOwnProfileScreenUiState } from "./useOwnProfileScreenUiState";
import { useProfileExperiencePrefetch, useProfileViewportPrefetch } from "./profilePrefetch";
import { useOwnProfileProjectionState } from "./useOwnProfileProjectionState";
import type { UseOwnProfileScreenStateParams } from "./ownProfileScreen.types";

export function useOwnProfileScreenState(params: UseOwnProfileScreenStateParams) {
  const { openFollowers, openFollowing, openSettings } = params;
  const bottomPadding = useBottomNavPadding();
  const { width, height } = useWindowDimensions();
  const queryClient = useQueryClient();
  const viewerKey = getViewerKey(params.userData);
  const { prefetchEventById, prefetchProfileByUsername } = useContentIntentPrefetch({
    id: params.userData.id,
    username: params.userData.username,
  });
  const uiState = useOwnProfileScreenUiState({ viewerKey });
  const {
    albumOwnerFilter,
    albumOwnerFilterExpanded,
    listRef,
    setAlbumOwnerFilter,
    setAlbumOwnerFilterExpanded,
    setTab,
    tab,
  } = uiState;
  const contentTab = tab as ProfileContentTab;
  const profileTab = tab as ProfileTab;
  const profileUsername = normalizeProfileValue(params.userData.username);
  const screenData = useOwnProfileProjectionState({
    accountType: params.accountType,
    contentTab,
    profileTab,
    profileUsername,
    userData: params.userData,
    viewerKey,
  });
  const { buildRelationByClub, refetch: refetchViewerRelations } = useViewerRelations({
    blockedUsers: params.blockedUsers,
    enabled: screenData.sourceAlbums.length > 0 || screenData.sourceEvents.length > 0,
    viewerId: params.userData.id,
    viewerUsername: params.userData.username,
  });
  const blockedSet = useMemo(
    () => createBlockedProfileSetExcludingSelf(params.blockedUsers || [], profileUsername),
    [params.blockedUsers, profileUsername],
  );
  const collectionState = useProfileCollectionsState({
    albumOwnerFilter,
    blockedSet,
    blockedUsers: params.blockedUsers || [],
    buildRelationByClub,
    profile: screenData.resolvedProfile,
    profileOwnerId: params.userData.id,
    projectionFetching:
      screenData.albumProjection.query.isFetching || screenData.eventProjection.query.isFetching,
    refreshing: screenData.refreshing,
    sourceAlbums: screenData.sourceAlbums,
    sourceEvents: screenData.sourceEvents,
    tab,
    username: profileUsername,
    viewerUsername: profileUsername,
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
  const disableProfilePrefetch =
    screenData.refreshing ||
    screenData.albumProjection.query.isFetching ||
    screenData.eventProjection.query.isFetching ||
    screenData.activeProjection.loadingMore;

  const viewportPrefetch = useProfileViewportPrefetch({
    disabled: disableProfilePrefetch,
    scopeKey: `${profileUsername}:${tab}`,
    tab: profileTab,
    viewerKey,
    viewerUserId: params.userData.id,
    viewerUsername: profileUsername,
  });
  useProfileExperiencePrefetch({
    albums: collections.albums,
    disabled: disableProfilePrefetch,
    events: collections.events,
    imageScopeKey: `${profileUsername}:${tab}:top-fold`,
    queryClient,
    screenKey: `profile:${viewerKey}:${profileUsername}:${tab}:intent`,
    tab: screenData.profileTab,
    viewerId: params.userData.id,
    viewerKey,
    viewerUsername: profileUsername,
  });

  useScrollToTopOnReselect({
    listRef,
    onReselect: params.onCloseViewer,
    reselectCounter: params.profileReselectCounter,
  });

  const displayName =
    screenData.resolvedUserData.clubName ||
    screenData.resolvedUserData.name ||
    screenData.resolvedUserData.username ||
    t("profile.title.default");
  const isLoading =
    (Boolean(screenData.profileBootstrap.isBootstrapping) || screenData.overviewQuery.isLoading) &&
    !screenData.resolvedProfile;
  const errorMessage = !screenData.overviewQuery.error
    ? null
    : mapAppDataErrorMessage(
        screenData.overviewQuery.error,
        {
          forbidden: t("profile.error.load"),
          not_found: t("profile.error.load"),
          unknown: t("profile.error.load"),
        },
        t("profile.error.load"),
      );
  const handleSetTab = useCallback(
    (nextTab: ProfileTab) => {
      setTab(nextTab);
      if (nextTab !== "album") {
        setAlbumOwnerFilterExpanded(false);
      }
    },
    [setAlbumOwnerFilterExpanded, setTab],
  );
  const handleOpenSettings = useCallback(() => {
    openSettings();
  }, [openSettings]);
  const handleOpenFollowers = useCallback(() => {
    openFollowers();
  }, [openFollowers]);
  const handleOpenFollowing = useCallback(() => {
    openFollowing();
  }, [openFollowing]);
  const refreshProfileProjection = screenData.onRefresh;
  const onRefresh = useCallback(async () => {
    await Promise.all([refreshProfileProjection(), refetchViewerRelations()]);
  }, [refetchViewerRelations, refreshProfileProjection]);
  const handleOpenProfile = params.openProfile;
  const handleOpenAlbumView = params.openAlbumView;
  const handleOpenEventDetail = params.openEventDetail;

  return {
    albumOwnerFilter,
    albumOwnerFilterExpanded,
    albumRelationByClub: collections.albumRelationByClub,
    albums: collections.albums,
    bottomPadding,
    displayName,
    emptyText: collections.emptyText,
    errorMessage,
    eventRelationByClub: collections.eventRelationByClub,
    events: collections.events,
    grid: collections.grid,
    handleOpenAlbumView,
    handleOpenEventDetail,
    handleOpenFollowers,
    handleOpenFollowing,
    handleOpenProfile,
    handleOpenSettings,
    handleSetTab,
    hasMore: screenData.activeProjection.hasMore,
    isLoading,
    listRef,
    loadMore: screenData.activeProjection.loadMore,
    loadingMore: screenData.loadingMore,
    numColumns: collections.numColumns,
    onRefresh,
    prefetchEventById,
    prefetchProfileByUsername,
    profileUsername,
    refreshing: screenData.refreshing,
    resolvedAccountType: screenData.resolvedAccountType,
    resolvedUserData: screenData.resolvedUserData,
    setAlbumOwnerFilter,
    setAlbumOwnerFilterExpanded,
    tab,
    tabs: collections.tabs,
    tileData: collections.tileData,
    viewportPrefetch,
  };
}
