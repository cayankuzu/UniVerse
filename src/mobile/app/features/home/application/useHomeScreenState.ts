import { useCallback, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useBottomNavPadding } from "../../../shared/layout/bottomNavSpacing";
import { useScrollToTopOnReselect } from "../../../shared/hooks/useScrollToTopOnReselect";
import { resolveStagedLoadState } from "../../../shared/loading/stagedLoad";
import { t } from "../../../shared/i18n";
import { useViewerRelations } from "../../../data/social";
import { mapAppDataErrorMessage } from "../../../data/errors/appDataError";
import { debugLog } from "../../../platform/logging/logger";
import { logProjectionMetric } from "../../../platform/observability";
import { useHomeFeedCollections } from "./useHomeFeedCollections";
import { useHomeScreenUiState } from "./useHomeScreenUiState";
import { getViewerKey } from "../../../data/contracts/viewerKey";
import { useHomeProjectionState } from "./useHomeProjectionState";
import { useHomeScreenPrefetch } from "./useHomeScreenPrefetch";
import type { HomeViewerData, UseHomeScreenStateParams } from "./homeScreen.types";

function logHomeCounts(params: {
  entityFilter: string;
  filteredItemsCount: number;
  sortOption: string;
  sourceFilter: string;
  typeFilter: string;
  unread: number;
  visibleAlbumsCount: number;
  visibleEventsCount: number;
}) {
  debugLog("HOME", "counts", {
    entityFilter: params.entityFilter,
    filteredItems: params.filteredItemsCount,
    sortOption: params.sortOption,
    sourceFilter: params.sourceFilter,
    typeFilter: params.typeFilter,
    unread: params.unread,
    visibleAlbums: params.visibleAlbumsCount,
    visibleEvents: params.visibleEventsCount,
  });
}

export function useHomeScreenState(params: UseHomeScreenStateParams) {
  const queryClient = useQueryClient();
  const bottomPadding = useBottomNavPadding();
  const viewerKey = getViewerKey(params.userData);
  const uiState = useHomeScreenUiState({ viewerKey });
  const viewer = useMemo<HomeViewerData>(
    () => ({
      accountType: params.accountType,
      id: params.userData.id,
      username: params.userData.username,
    }),
    [params.accountType, params.userData.id, params.userData.username],
  );

  const projectionState = useHomeProjectionState({
    blockedUsers: params.blockedUsers,
    uiState,
    userData: params.userData,
    viewer,
    viewerKey,
  });
  useScrollToTopOnReselect({
    listRef: uiState.listRef,
    onReselect: () => uiState.setViewerIndex(null),
    onSecondReselect: projectionState.onRefresh,
    reselectCounter: params.homeReselectCounter,
  });
  const relationReadsEnabled =
    projectionState.speedGate.allowSecondaryReads &&
    (projectionState.hasHomeProjectionContent || projectionState.shouldUseStartupPreview);
  const viewerRelations = useViewerRelations({
    blockedUsers: params.blockedUsers,
    enabled: relationReadsEnabled,
    viewerId: params.userData.id,
    viewerUsername: params.userData.username,
  });

  const unread = projectionState.unread;
  const collections = useHomeFeedCollections({
    blockedUsers: params.blockedUsers,
    buildRelationByClub: viewerRelations.buildRelationByClub,
    enforceFollowVisibility: relationReadsEnabled && !viewerRelations.isLoading,
    followingClubUsernames: viewerRelations.followingClubUsernames,
    followingUsernames: viewerRelations.followingUsernames,
    homeProjectionIdsLength: projectionState.homeProjection.screenState?.ids?.length,
    homeProjectionItems: projectionState.homeProjection.items,
    isFetching: projectionState.homeProjection.query.isFetching,
    startupPreviewItems: projectionState.startupPreviewItems,
    useStartupPreview: projectionState.shouldUseStartupPreview,
    refreshing: projectionState.refreshing,
    viewerUsername: params.userData.username,
  });

  const suspendPrefetch =
    !projectionState.speedGate.allowPrefetch ||
    projectionState.refreshing ||
    projectionState.homeProjection.query.isFetching ||
    projectionState.homeProjection.loadingMore ||
    uiState.viewerIndex !== null;
  const prefetchState = useHomeScreenPrefetch({
    collections,
    filterScope: projectionState.filterScope,
    queryClient,
    suspendPrefetch,
    userData: params.userData,
    viewer,
    viewerKey,
  });
  const isLoading =
    projectionState.homeProjection.shouldShowInitialSkeleton &&
    !projectionState.shouldUseStartupPreview;
  const isError = projectionState.homeProjection.query.error;
  const errorMessage = !isError
    ? null
    : mapAppDataErrorMessage(
        isError,
        {
          network: `${t("home.error.title")} ${t("home.error.subtitle")}`,
          unknown: `${t("home.error.title")} ${t("home.error.subtitle")}`,
        },
        `${t("home.error.title")} ${t("home.error.subtitle")}`,
      );
  const loadingMore = projectionState.homeProjection.loadingMore;
  const hasMore = projectionState.homeProjection.hasMore;
  const onUserInteraction = uiState.markUserInteracted;
  const onFeedFirstDraw = useCallback((durationMs: number) => {
    logProjectionMetric({
      durationMs,
      name: "feed_first_draw",
      screenKey: "home",
      status: "ok",
    });
  }, []);
  const refreshHomeProjection = projectionState.onRefresh;
  const loadMoreHomeProjection = projectionState.homeProjection.loadMore;
  const refetchViewerRelations = viewerRelations.refetch;
  const onRefresh = useCallback(async () => {
    onUserInteraction();
    await Promise.all([refreshHomeProjection(), refetchViewerRelations()]);
  }, [onUserInteraction, refetchViewerRelations, refreshHomeProjection]);
  const loadMore = useCallback(async () => {
    onUserInteraction();
    await loadMoreHomeProjection();
  }, [loadMoreHomeProjection, onUserInteraction]);
  const loadState = resolveStagedLoadState({
    backgroundRefreshing:
      projectionState.homeProjection.backgroundRefreshing ||
      projectionState.homeProjection.query.isFetching,
    error: Boolean(isError),
    hasContent: collections.effectiveItems.length > 0,
    isLoading,
    refreshing: projectionState.refreshing,
  });

  useEffect(() => {
    logHomeCounts({
      entityFilter: uiState.deferredEntityFilter,
      filteredItemsCount: collections.effectiveItems.length,
      sortOption: uiState.deferredSortOption,
      sourceFilter: uiState.deferredSourceFilter,
      typeFilter: uiState.deferredTypeFilter,
      unread,
      visibleAlbumsCount: collections.visibleAlbums.length,
      visibleEventsCount: collections.visibleEvents.length,
    });
  }, [
    collections.effectiveItems.length,
    collections.visibleAlbums.length,
    collections.visibleEvents.length,
    unread,
    uiState.deferredEntityFilter,
    uiState.deferredSortOption,
    uiState.deferredSourceFilter,
    uiState.deferredTypeFilter,
  ]);

  return {
    accountType: params.accountType,
    activeFilterCount: uiState.activeFilterCount,
    albumRelationByClub: collections.albumRelationByClub,
    bottomPadding,
    defaultSource: uiState.defaultSource,
    entityFilter: uiState.entityFilter,
    eventRelationByClub: collections.eventRelationByClub,
    errorMessage,
    filteredItems: collections.effectiveItems,
    hasMore,
    isError,
    listRef: uiState.listRef,
    loadMore,
    loadState,
    loadingMore,
    onRefresh,
    onNotificationsPressIn: prefetchState.onNotificationsPressIn,
    onFeedFirstDraw,
    onUserInteraction,
    onViewableItemsChanged: prefetchState.onViewableItemsChanged,
    refreshing: projectionState.refreshing,
    setEntityFilter: uiState.setEntityFilter,
    setShowFilters: uiState.setShowFilters,
    setSortOption: uiState.setSortOption,
    setSourceFilter: uiState.setSourceFilter,
    setTypeFilter: uiState.setTypeFilter,
    setViewerIndex: uiState.setViewerIndex,
    setWarningMessage: uiState.setWarningMessage,
    showFilters: uiState.showFilters,
    sortOption: uiState.sortOption,
    sourceFilter: uiState.sourceFilter,
    tourAlbumIndex: collections.tourAlbumIndex,
    tourEventIndex: collections.tourEventIndex,
    typeFilter: uiState.typeFilter,
    unread,
    userData: params.userData,
    viewabilityConfig: prefetchState.viewabilityConfig,
    viewerIndex: uiState.viewerIndex,
    warningMessage: uiState.warningMessage,
  };
}
