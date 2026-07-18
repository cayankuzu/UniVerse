import { useCallback, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWindowDimensions } from "react-native";
import { getViewerKey } from "../../../data/contracts/viewerKey";
import type { AuthUserData } from "../../../data/contracts/entities";
import { useViewerRelations } from "../../../data/social";
import { useBottomNavPadding } from "../../../shared/layout/bottomNavSpacing";
import { getThreeColumnGridMetrics } from "../../../shared/layout/gridMetrics";
import {
  getResponsiveGridColumns,
  getResponsiveLayoutTokens,
} from "../../../shared/layout/responsive";
import { resolveSearchEmptyText } from "./searchFiltering";
import { useSearchResultCollections } from "./useSearchResultCollections";
import { useSearchUiState } from "./useSearchUiState";
import { useSearchProjectionState } from "./useSearchProjectionState";
import { useSearchPrefetch } from "./useSearchPrefetch";
import { useSeedSearchProfileOverviewSummary } from "./useSeedSearchProfileOverviewSummary";
import { logSearchCounts } from "./searchResults.logging";

export function useSearchResults(params: {
  blockedUsers?: string[];
  searchReselectCounter: number;
  userData: AuthUserData;
}) {
  const queryClient = useQueryClient();
  const viewerIdentity = useMemo(
    () => ({
      userId: params.userData.id,
      username: params.userData.username,
    }),
    [params.userData.id, params.userData.username],
  );
  const viewerKey = getViewerKey(params.userData);
  const bottomPadding = useBottomNavPadding();
  const { width, height } = useWindowDimensions();
  const searchUi = useSearchUiState({
    searchReselectCounter: params.searchReselectCounter,
    viewerKey,
  });
  const responsiveTokens = useMemo(() => getResponsiveLayoutTokens(width, height), [height, width]);
  const projectionState = useSearchProjectionState({
    searchUi,
    userData: params.userData,
    viewerKey,
  });
  const searchLogState = useMemo(
    () => ({
      hasSearchIntent: searchUi.hasSearchIntent,
      query: searchUi.query,
      selectedCategory: searchUi.selectedCategory,
      selectedFee: searchUi.selectedFee,
      selectedUniversity: searchUi.selectedUniversity,
      sortOption: searchUi.sortOption,
      type: searchUi.type,
    }),
    [
      searchUi.hasSearchIntent,
      searchUi.query,
      searchUi.selectedCategory,
      searchUi.selectedFee,
      searchUi.selectedUniversity,
      searchUi.sortOption,
      searchUi.type,
    ],
  );
  const {
    buildRelationByClub,
    followingClubUsernames,
    followingUsernames,
    refetch: refetchViewerRelations,
  } = useViewerRelations({
    blockedUsers: params.blockedUsers,
    enabled: projectionState.searchProjection.items.length > 0,
    viewerId: params.userData.id,
    viewerUsername: params.userData.username,
  });

  const searchResultData = projectionState.searchProjection.items;
  const numColumns = getResponsiveGridColumns(width, { tabletPortrait: 3 });
  const grid = useMemo(
    () =>
      getThreeColumnGridMetrics({
        bottomReserved: Math.max(bottomPadding, 86),
        columns: numColumns,
        horizontalPadding: 0,
        maxCardHeight:
          responsiveTokens.deviceClass === "tabletPortrait"
            ? searchUi.isUserGridType
              ? 244
              : 312
            : searchUi.isUserGridType
              ? 206
              : 272,
        minCardHeight: searchUi.isUserGridType ? 182 : 216,
        rowsVisible: searchUi.isUserGridType
          ? responsiveTokens.deviceClass === "tabletPortrait"
            ? 4
            : 3.5
          : 3,
        screenHeight: height,
        screenWidth: width,
        topReserved: responsiveTokens.deviceClass === "tabletPortrait" ? 184 : 160,
      }),
    [
      bottomPadding,
      height,
      numColumns,
      responsiveTokens.deviceClass,
      searchUi.isUserGridType,
      width,
    ],
  );
  const {
    activeSearchItems,
    filteredAlbums,
    filteredClubs,
    filteredEvents,
    filteredStudents,
    rawAlbums,
    rawClubs,
    rawEvents,
    rawStudents,
    relationByClub,
  } = useSearchResultCollections({
    blockedUsers: params.blockedUsers,
    buildRelationByClub,
    excludeFollowedContent: !searchUi.hasDebouncedSearchIntent,
    followingClubUsernames,
    followingUsernames,
    searchProjectionItems: searchResultData,
    searchType: searchUi.type,
    viewerIdentity,
  });

  useEffect(() => {
    logSearchCounts({
      filteredCounts: {
        albums: filteredAlbums.length,
        clubs: filteredClubs.length,
        events: filteredEvents.length,
        students: filteredStudents.length,
      },
      nextCursor: projectionState.searchProjection.screenState?.nextCursor,
      rawCounts: {
        albums: rawAlbums.length,
        clubs: rawClubs.length,
        events: rawEvents.length,
        students: rawStudents.length,
      },
      searchState: searchLogState,
    });
  }, [
    filteredAlbums.length,
    filteredClubs.length,
    filteredEvents.length,
    filteredStudents.length,
    rawAlbums.length,
    rawClubs.length,
    rawEvents.length,
    rawStudents.length,
    projectionState.searchProjection.screenState?.nextCursor,
    searchLogState,
  ]);
  const prefetchState = useSearchPrefetch({
    activeSearchItems,
    effectiveSearchScope: searchUi.effectiveSearchScope,
    loadingMore: projectionState.loadingMore,
    refreshing: projectionState.refreshing,
    searchProjectionFetching: projectionState.searchProjection.query.isFetching,
    searchType: searchUi.type,
    userData: params.userData,
    viewerKey,
  });
  const seedProfileOverviewSummary = useSeedSearchProfileOverviewSummary({
    queryClient,
    viewerKey,
  });
  const refreshSearchProjection = projectionState.onRefresh;
  const onRefresh = useCallback(async () => {
    await Promise.all([refreshSearchProjection(), refetchViewerRelations()]);
  }, [refreshSearchProjection, refetchViewerRelations]);

  const emptyText = resolveSearchEmptyText(searchUi.type, searchUi.hasSearchIntent);
  const topPanelBusy =
    searchUi.isSearchRequestPending ||
    (projectionState.searchProjection.query.isFetching &&
      !projectionState.currentLoading &&
      !projectionState.loadingMore &&
      !projectionState.refreshing);

  return {
    activeFilterCount: searchUi.activeFilterCount,
    albumRelationByClub: relationByClub,
    bottomPadding,
    currentError: projectionState.currentError,
    currentLoading: projectionState.currentLoading,
    emptyText,
    filteredAlbums,
    filteredClubs,
    filteredEvents,
    filteredStudents,
    grid,
    hasMore: projectionState.searchProjection.hasMore,
    listRef: searchUi.listRef,
    loadMore: projectionState.searchProjection.loadMore,
    loadingMore: projectionState.loadingMore,
    numColumns,
    onRefresh,
    onSelectType: searchUi.onSelectType,
    prefetchEventById: prefetchState.prefetchEventById,
    prefetchProfileByUsername: prefetchState.prefetchProfileByUsername,
    query: searchUi.query,
    refreshing: projectionState.refreshing,
    seedProfileOverviewSummary,
    selectedCategory: searchUi.selectedCategory,
    selectedFee: searchUi.selectedFee,
    selectedUniversity: searchUi.selectedUniversity,
    setQuery: searchUi.setQuery,
    setSelectedCategory: searchUi.setSelectedCategory,
    setSelectedFee: searchUi.setSelectedFee,
    setSelectedUniversity: searchUi.setSelectedUniversity,
    setShowFilters: searchUi.setShowFilters,
    setSortOption: searchUi.setSortOption,
    setViewerIndex: searchUi.setViewerIndex,
    setViewerType: searchUi.setViewerType,
    setWarningMessage: searchUi.setWarningMessage,
    showFilters: searchUi.showFilters,
    sortOption: searchUi.sortOption,
    supportsFilters: searchUi.supportsFilters,
    topPanelBusy,
    type: searchUi.type,
    userData: params.userData,
    viewerIndex: searchUi.viewerIndex,
    viewerType: searchUi.viewerType,
    viewportPrefetch: prefetchState.viewportPrefetch,
    warningMessage: searchUi.warningMessage,
  };
}
