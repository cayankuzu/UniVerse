import React, { useCallback, useEffect, useMemo, useRef } from "react";
import type { ViewToken } from "@shopify/flash-list";
import {
  FlatList,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import {
  DiscoveryAlbumGridCard,
  DiscoveryEventGridCard,
  DiscoveryUserGridCard,
} from "../../../features/content-cards/public/cards";
import { buildPreparedAlbumVisibility } from "../../content-cards/public/presentation";
import { TourAnchor } from "../../../app-shell/onboarding";
import { AppFlatList, AppListSkeleton, type AppFlatListRef } from "../../../shared/components";
import type { AlbumPhotoWithMeta, EventWithMeta, SearchUserResult } from "../data/searchTypes";
import { resolveSearchEventAccess } from "../application/searchCardPresentation";
import type { SearchType } from "../domain/types";

type GridMetrics = {
  cardHeight: number;
  cardWidth: number;
  horizontalPadding: number;
  mediaHeight: number;
  rowGap: number;
};

type SearchResultItem = AlbumPhotoWithMeta | EventWithMeta | SearchUserResult;
const SEARCH_RESULT_PAGES: SearchType[] = ["albums", "events", "clubs", "students"];
const noop = () => undefined;

type ViewabilityInfo<TItem> = {
  changed: ViewToken<TItem>[];
  viewableItems: ViewToken<TItem>[];
};

type ViewportPrefetch<TItem> = {
  onViewableItemsChanged?: (info: ViewabilityInfo<TItem>) => void;
  viewabilityConfig?: Record<string, unknown>;
};

type SearchProfileSummaryInput = {
  accountType?: "club" | "student";
  bio?: string;
  categories?: string[];
  coverImage?: string;
  coverImageVariants?: {
    full?: string | null;
    medium?: string | null;
    thumbnail?: string | null;
  };
  createdAt?: string;
  department?: string;
  description?: string;
  id: string;
  image: string;
  imageVariants?: {
    full?: string | null;
    medium?: string | null;
    thumbnail?: string | null;
  };
  isPrivate: boolean;
  name: string;
  university: string;
  username: string;
  year?: string;
};

type SearchResultsGridProps<T extends { id: string }> = {
  bottomPadding: number;
  currentError: string | null;
  currentLoading: boolean;
  data: T[];
  emptyText: string;
  grid: GridMetrics;
  hasMore?: boolean;
  listKey: string;
  listRef?: React.RefObject<AppFlatListRef<SearchResultItem> | null>;
  loadingMore: boolean;
  numColumns: number;
  onEndReached: () => void;
  onRefresh: () => void;
  onViewableItemsChanged?: (info: ViewabilityInfo<T>) => void;
  refreshing: boolean;
  renderCard: (item: T, index: number) => React.ReactElement;
  showFooter: boolean;
  viewabilityConfig?: Record<string, unknown>;
};

type SearchResultsContentProps = {
  bottomPadding: number;
  currentError: string | null;
  currentLoading: boolean;
  emptyText: string;
  filteredAlbums: AlbumPhotoWithMeta[];
  filteredClubs: SearchUserResult[];
  filteredEvents: EventWithMeta[];
  filteredStudents: SearchUserResult[];
  grid: GridMetrics;
  hasMore?: boolean;
  listRef: React.RefObject<AppFlatListRef<SearchResultItem> | null>;
  loadingMore: boolean;
  numColumns: number;
  onEndReached: () => void;
  onOpenAlbumCard: (item: AlbumPhotoWithMeta, index: number) => void;
  onOpenEventCard: (item: EventWithMeta, index: number) => void;
  onOpenProfile: (profile: SearchProfileSummaryInput) => void;
  onRefresh: () => void;
  onSelectType: (type: SearchType) => void;
  pagerEnabled?: boolean;
  prefetchEventById: (eventId: string) => unknown;
  prefetchProfileByUsername: (username: string) => unknown;
  refreshing: boolean;
  type: SearchType;
  viewportPrefetch: ViewportPrefetch<SearchResultItem>;
};

function SearchResultsGrid<T extends { id: string }>({
  bottomPadding,
  currentError,
  currentLoading,
  data,
  emptyText,
  grid,
  hasMore,
  listKey,
  listRef,
  loadingMore,
  numColumns,
  onEndReached,
  onRefresh,
  onViewableItemsChanged,
  refreshing,
  renderCard,
  showFooter,
  viewabilityConfig,
}: SearchResultsGridProps<T>) {
  const columnWrapperStyle = useMemo(
    () => ({
      justifyContent: "flex-start" as const,
      columnGap: grid.rowGap,
      marginBottom: grid.rowGap,
    }),
    [grid.rowGap],
  );
  const contentContainerStyle = useMemo(
    () => ({
      flexGrow: 1,
      paddingHorizontal: grid.horizontalPadding,
      paddingTop: 8,
      paddingBottom: bottomPadding,
    }),
    [bottomPadding, grid.horizontalPadding],
  );
  const loadingComponent = useMemo(
    () => (
      <AppListSkeleton
        columns={numColumns}
        horizontalPadding={grid.horizontalPadding}
        itemHeight={grid.cardHeight}
        variant="grid"
      />
    ),
    [grid.cardHeight, grid.horizontalPadding, numColumns],
  );
  const renderItem = useCallback(
    ({ item, index }: { index: number; item: T }) => (item ? renderCard(item, index) : null),
    [renderCard],
  );

  return (
    <AppFlatList
      ref={listRef as React.RefObject<AppFlatListRef<T> | null> | undefined}
      alwaysBounceVertical
      columnWrapperStyle={columnWrapperStyle}
      contentContainerStyle={contentContainerStyle}
      data={data}
      emptyText={emptyText}
      error={currentError}
      estimatedItemSize={grid.cardHeight + grid.rowGap}
      getItemType={() => "search-grid-card"}
      hasMore={showFooter ? hasMore : undefined}
      key={listKey}
      keyExtractor={(item, index) => String(item?.id || index)}
      loading={currentLoading}
      loadingComponent={loadingComponent}
      loadingMore={showFooter ? loadingMore : false}
      numColumns={numColumns}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.82}
      onRefresh={onRefresh}
      onViewableItemsChanged={onViewableItemsChanged}
      overScrollMode="always"
      performanceTier="tier1"
      refreshing={refreshing}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      style={{ flex: 1 }}
      viewabilityConfig={viewabilityConfig}
    />
  );
}

export function SearchResultsContent(props: SearchResultsContentProps) {
  const { onSelectType, type: selectedType } = props;
  const {
    grid,
    onOpenAlbumCard,
    onOpenEventCard,
    onOpenProfile,
    prefetchEventById,
    prefetchProfileByUsername,
  } = props;
  const pagerRef = useRef<FlatList<SearchType> | null>(null);
  const didMountRef = useRef(false);
  const { width } = useWindowDimensions();
  const pageWidth = Math.max(1, width);
  const activeIndex = Math.max(0, SEARCH_RESULT_PAGES.indexOf(props.type));
  const albumListKey = useMemo(
    () => `albums-${props.grid.cardWidth}-${props.grid.cardHeight}`,
    [props.grid.cardHeight, props.grid.cardWidth],
  );
  const eventListKey = useMemo(
    () => `events-${props.grid.cardWidth}-${props.grid.cardHeight}`,
    [props.grid.cardHeight, props.grid.cardWidth],
  );
  const userListKey = useMemo(
    () => `${props.type}-${props.grid.cardWidth}-${props.grid.cardHeight}`,
    [props.grid.cardHeight, props.grid.cardWidth, props.type],
  );
  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      pagerRef.current?.scrollToIndex({
        animated: didMountRef.current,
        index: activeIndex,
      });
      didMountRef.current = true;
    });
    return () => cancelAnimationFrame(handle);
  }, [activeIndex, pageWidth]);
  const renderAlbumCard = useCallback(
    (item: AlbumPhotoWithMeta, index: number) => {
      const visibility = buildPreparedAlbumVisibility(item, "search");
      return (
        <TourAnchor
          tourId="search-feed-card"
          enabled={index === 0}
          style={{ width: grid.cardWidth }}
        >
          <DiscoveryAlbumGridCard
            visibility={visibility}
            cardHeight={grid.cardHeight}
            cardWidth={grid.cardWidth}
            item={item}
            mediaHeight={grid.mediaHeight}
            onPrefetchEvent={(eventId) => {
              void prefetchEventById(eventId);
            }}
            onPress={() => onOpenAlbumCard(item, index)}
          />
        </TourAnchor>
      );
    },
    [grid.cardHeight, grid.cardWidth, grid.mediaHeight, onOpenAlbumCard, prefetchEventById],
  );
  const renderEventCard = useCallback(
    (item: EventWithMeta, index: number) => (
      <TourAnchor tourId="search-feed-card" enabled={index === 0} style={{ width: grid.cardWidth }}>
        <DiscoveryEventGridCard
          access={resolveSearchEventAccess(item)}
          cardHeight={grid.cardHeight}
          cardWidth={grid.cardWidth}
          item={item}
          mediaHeight={grid.mediaHeight}
          onPrefetchEvent={(eventId) => {
            void prefetchEventById(eventId);
          }}
          onPress={() => onOpenEventCard(item, index)}
        />
      </TourAnchor>
    ),
    [grid.cardHeight, grid.cardWidth, grid.mediaHeight, onOpenEventCard, prefetchEventById],
  );
  const renderUserCard = useCallback(
    (item: SearchUserResult) => (
      <DiscoveryUserGridCard
        cardHeight={grid.cardHeight}
        cardWidth={grid.cardWidth}
        item={item}
        mediaHeight={grid.mediaHeight}
        onPrefetchProfile={(username) => {
          void prefetchProfileByUsername(username);
        }}
        onPress={onOpenProfile}
      />
    ),
    [grid.cardHeight, grid.cardWidth, grid.mediaHeight, onOpenProfile, prefetchProfileByUsername],
  );
  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = Math.max(
        0,
        Math.min(
          SEARCH_RESULT_PAGES.length - 1,
          Math.round(event.nativeEvent.contentOffset.x / pageWidth),
        ),
      );
      const nextType = SEARCH_RESULT_PAGES[nextIndex];
      if (nextType && nextType !== selectedType) {
        onSelectType(nextType);
      }
    },
    [onSelectType, pageWidth, selectedType],
  );
  const renderPage = useCallback(
    ({ item: pageType }: { item: SearchType }) => {
      const isActive = pageType === props.type;
      const pageProps = {
        bottomPadding: props.bottomPadding,
        currentError: isActive ? props.currentError : null,
        currentLoading: isActive ? props.currentLoading : false,
        emptyText: isActive ? props.emptyText : "",
        grid: props.grid,
        hasMore: isActive ? props.hasMore : undefined,
        listRef: isActive ? props.listRef : undefined,
        loadingMore: isActive ? props.loadingMore : false,
        numColumns: props.numColumns,
        onEndReached: isActive ? props.onEndReached : noop,
        onRefresh: isActive ? props.onRefresh : noop,
        onViewableItemsChanged: isActive
          ? props.viewportPrefetch.onViewableItemsChanged
          : undefined,
        refreshing: isActive ? props.refreshing : false,
        viewabilityConfig: isActive ? props.viewportPrefetch.viewabilityConfig : undefined,
      };
      if (pageType === "albums") {
        return (
          <View style={{ width: pageWidth, flex: 1 }}>
            <SearchResultsGrid
              {...pageProps}
              data={props.filteredAlbums}
              listKey={albumListKey}
              renderCard={renderAlbumCard}
              showFooter={isActive && props.filteredAlbums.length > 0}
            />
          </View>
        );
      }
      if (pageType === "events") {
        return (
          <View style={{ width: pageWidth, flex: 1 }}>
            <SearchResultsGrid
              {...pageProps}
              data={props.filteredEvents}
              listKey={eventListKey}
              renderCard={renderEventCard}
              showFooter={isActive && props.filteredEvents.length > 0}
            />
          </View>
        );
      }
      const userItems = pageType === "clubs" ? props.filteredClubs : props.filteredStudents;
      return (
        <View style={{ width: pageWidth, flex: 1 }}>
          <SearchResultsGrid
            {...pageProps}
            data={userItems}
            listKey={`${pageType}-${userListKey}`}
            renderCard={renderUserCard}
            showFooter={isActive && userItems.length > 0}
          />
        </View>
      );
    },
    [
      albumListKey,
      eventListKey,
      pageWidth,
      props,
      renderAlbumCard,
      renderEventCard,
      renderUserCard,
      userListKey,
    ],
  );
  return (
    <FlatList
      ref={pagerRef}
      data={SEARCH_RESULT_PAGES}
      extraData={selectedType}
      getItemLayout={(_, index) => ({ index, length: pageWidth, offset: pageWidth * index })}
      horizontal
      initialNumToRender={1}
      initialScrollIndex={activeIndex}
      keyExtractor={(item) => item}
      keyboardShouldPersistTaps="handled"
      onMomentumScrollEnd={handleMomentumScrollEnd}
      onScrollToIndexFailed={({ index }) => {
        pagerRef.current?.scrollToOffset({ animated: false, offset: pageWidth * index });
      }}
      overScrollMode="never"
      pagingEnabled
      maxToRenderPerBatch={1}
      removeClippedSubviews={false}
      renderItem={renderPage}
      scrollEnabled={props.pagerEnabled !== false}
      showsHorizontalScrollIndicator={false}
      style={{ flex: 1 }}
      windowSize={3}
    />
  );
}
