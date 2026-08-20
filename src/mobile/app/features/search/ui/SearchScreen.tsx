import React, { useCallback, useEffect, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../../app-shell/auth";
import {
  useOpenAlbumView,
  useOpenEventDetail,
  useOpenProfile,
} from "../../../app-shell/navigation/hooks/useIntentNavigation";
import { useTabReselectCounter } from "../../../app-shell/navigation/TabReselectContext";
import { SwipeableTabPager } from "../../../shared/components/SwipeableTabPager";
import { useTabScrollMemory } from "../../../shared/hooks/useTabScrollMemory";
import type { RootStackParamList } from "../../../app-shell/navigation/types";
import { useSearchResults } from "../application/useSearchResults";
import { resolveSearchAlbumOpenDecision } from "../application/searchAlbumAccess";
import type { RelationSnapshot } from "../data";
import type { SearchProfileSummarySeed } from "../application/useSeedSearchProfileOverviewSummary";
import { SearchFeedViewers } from "./SearchFeedViewers";
import { SearchResultsContent } from "./SearchResultsContent";
import { SearchTopPanel } from "./SearchTopPanel";
import { C, TABS } from "./searchHelpers";

type Props = NativeStackScreenProps<RootStackParamList, "Search">;
const SEARCH_SWIPE_TABS = ["albums", "events", "clubs", "students"] as const;
type SearchSwipeTab = (typeof SEARCH_SWIPE_TABS)[number];
const SEARCH_TAB_LABELS = Object.fromEntries(TABS.map((tab) => [tab.key, tab.label])) as Record<
  SearchSwipeTab,
  string
>;

export function SearchScreen({ navigation }: Props) {
  const { accountType, blockedUsers, userData } = useAuth();
  const [viewerTargetId, setViewerTargetId] = useState<string | null>(null);
  const openProfile = useOpenProfile(navigation, userData);
  const openAlbumEvent = useOpenEventDetail(navigation, userData);
  const openAlbumList = useOpenAlbumView(navigation, userData);
  const searchReselectCounter = useTabReselectCounter("search");
  const {
    activeFilterCount,
    albumRelationByClub,
    bottomPadding,
    currentError,
    currentLoading,
    emptyText,
    filteredAlbums,
    filteredClubs,
    filteredEvents,
    filteredStudents,
    grid,
    hasMore,
    loadMore,
    listRef,
    loadingMore,
    numColumns,
    onRefresh,
    onSelectType,
    prefetchEventById,
    prefetchProfileByUsername,
    query,
    refreshing,
    seedProfileOverviewSummary,
    selectedCategory,
    selectedFee,
    selectedUniversity,
    setQuery,
    setSelectedCategory,
    setSelectedFee,
    setSelectedUniversity,
    setShowFilters,
    setSortOption,
    setViewerIndex,
    setViewerType,
    setWarningMessage,
    showFilters,
    sortOption,
    supportsFilters,
    topPanelBusy,
    type,
    viewerIndex,
    viewerType,
    viewportPrefetch,
    warningMessage,
  } = useSearchResults({
    blockedUsers,
    searchReselectCounter,
    userData,
  });
  const { getTabScrollRef, recordTabScrollOffset, restoreTabScrollOffset, setTabScrollRef } =
    useTabScrollMemory<SearchSwipeTab>();
  const setSearchListRef = useCallback(
    (
      pageType: SearchSwipeTab,
      node: { scrollToOffset: (params: { animated: boolean; offset: number }) => void } | null,
    ) => {
      setTabScrollRef(pageType, node);
    },
    [setTabScrollRef],
  );
  useEffect(() => {
    listRef.current = getTabScrollRef(type) as unknown as typeof listRef.current;
    restoreTabScrollOffset(type);
  }, [getTabScrollRef, listRef, restoreTabScrollOffset, type]);
  const handleSearchScrollOffsetChange = useCallback(
    (pageType: SearchSwipeTab, offset: number) => {
      recordTabScrollOffset(pageType, offset);
    },
    [recordTabScrollOffset],
  );
  const handleOpenProfile = useCallback(
    (value: string | SearchProfileSummarySeed) => {
      if (typeof value !== "string") {
        seedProfileOverviewSummary(value);
      }
      openProfile(typeof value === "string" ? value.trim() : String(value.username || "").trim());
    },
    [openProfile, seedProfileOverviewSummary],
  );
  const handleOpenAlbumEvent = useCallback(
    (eventId: string) => {
      openAlbumEvent(eventId);
    },
    [openAlbumEvent],
  );
  const handleOpenAlbumList = useCallback(
    (eventId: string) => {
      openAlbumList(eventId);
    },
    [openAlbumList],
  );
  const handleEndReached = useCallback(() => {
    if (loadingMore) return;
    void loadMore();
  }, [loadMore, loadingMore]);
  const handleSelectType = useCallback(
    (nextType: SearchSwipeTab) => {
      restoreTabScrollOffset(nextType);
      onSelectType(nextType);
    },
    [onSelectType, restoreTabScrollOffset],
  );
  const handleOpenAlbumCard = useCallback(
    (item: (typeof filteredAlbums)[number], index: number) => {
      const decision = resolveSearchAlbumOpenDecision({
        currentUsername: userData.username || "",
        item,
        relationByClub: albumRelationByClub as Record<string, RelationSnapshot>,
      });
      if (decision.kind === "viewer") {
        setViewerTargetId(String(item.id || "").trim() || null);
        setViewerType("albums");
        setViewerIndex(index);
        return;
      }
      setWarningMessage(decision.message);
    },
    [albumRelationByClub, setViewerIndex, setViewerType, setWarningMessage, userData.username],
  );
  const handleOpenEventCard = useCallback(
    (item: (typeof filteredEvents)[number], index: number) => {
      setViewerTargetId(String(item?.id || "").trim() || null);
      setViewerType("events");
      setViewerIndex(index);
    },
    [setViewerIndex, setViewerType],
  );
  const renderResults = (pageType: SearchSwipeTab, preview: boolean) => (
    <SearchResultsContent
      bottomPadding={bottomPadding}
      currentError={currentError}
      currentLoading={currentLoading}
      emptyText={emptyText}
      filteredAlbums={filteredAlbums}
      filteredClubs={filteredClubs}
      filteredEvents={filteredEvents}
      filteredStudents={filteredStudents}
      grid={grid}
      hasMore={hasMore}
      loadingMore={loadingMore}
      numColumns={numColumns}
      onEndReached={handleEndReached}
      onListRef={setSearchListRef}
      onOpenAlbumCard={handleOpenAlbumCard}
      onOpenEventCard={handleOpenEventCard}
      onOpenProfile={handleOpenProfile}
      onRefresh={onRefresh}
      onScrollOffsetChange={handleSearchScrollOffsetChange}
      prefetchEventById={prefetchEventById}
      prefetchProfileByUsername={prefetchProfileByUsername}
      preview={preview}
      refreshing={refreshing}
      type={pageType}
      viewportPrefetch={viewportPrefetch}
    />
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <SearchTopPanel
        activeFilterCount={activeFilterCount}
        onSelectType={handleSelectType}
        query={query}
        selectedCategory={selectedCategory}
        selectedFee={selectedFee}
        selectedUniversity={selectedUniversity}
        setQuery={setQuery}
        setSelectedCategory={setSelectedCategory}
        setSelectedFee={setSelectedFee}
        setSelectedUniversity={setSelectedUniversity}
        setShowFilters={setShowFilters}
        setSortOption={setSortOption}
        showFilters={showFilters}
        sortOption={sortOption}
        supportsFilters={supportsFilters}
        topPanelBusy={topPanelBusy}
        type={type}
      />

      <SwipeableTabPager
        activeTab={type}
        enabled={!showFilters && !viewerType}
        getTabAccessibilityLabel={(tab) => SEARCH_TAB_LABELS[tab]}
        keepAlive={false}
        lazy
        onChange={handleSelectType}
        onPreviewTabChange={restoreTabScrollOffset}
        renderPage={renderResults}
        tabs={SEARCH_SWIPE_TABS}
      />

      <SearchFeedViewers
        accountType={accountType}
        albums={filteredAlbums}
        events={filteredEvents}
        initialItemId={viewerTargetId}
        onCloseViewer={() => {
          setViewerTargetId(null);
          setViewerType(null);
        }}
        onOpenAlbum={handleOpenAlbumList}
        onOpenClubProfile={handleOpenProfile}
        onOpenEventFromAlbum={handleOpenAlbumEvent}
        onOpenUserProfile={handleOpenProfile}
        onRefresh={onRefresh}
        refreshing={refreshing}
        relationByClub={albumRelationByClub}
        setWarningMessage={setWarningMessage}
        viewer={userData}
        viewerIndex={viewerIndex}
        viewerType={viewerType}
        warningMessage={warningMessage}
      />
    </SafeAreaView>
  );
}
