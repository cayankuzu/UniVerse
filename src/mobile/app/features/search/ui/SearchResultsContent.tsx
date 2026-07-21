import React, { useCallback, useMemo, useRef } from "react";
import type { ViewToken } from "@shopify/flash-list";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
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
import { tokens } from "../../../shared/theme";

type GridMetrics = {
  cardHeight: number;
  cardWidth: number;
  horizontalPadding: number;
  mediaHeight: number;
  rowGap: number;
};

type SearchResultItem = AlbumPhotoWithMeta | EventWithMeta | SearchUserResult;

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
  onListRef?: (node: AppFlatListRef<SearchResultItem> | null) => void;
  onRefresh: () => void;
  onScrollOffsetChange?: (offset: number) => void;
  onViewableItemsChanged?: (info: ViewabilityInfo<T>) => void;
  refreshing: boolean;
  renderCard: (item: T, index: number) => React.ReactElement;
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
  listRef?: React.RefObject<AppFlatListRef<SearchResultItem> | null>;
  loadingMore: boolean;
  numColumns: number;
  onEndReached: () => void;
  onOpenAlbumCard: (item: AlbumPhotoWithMeta, index: number) => void;
  onOpenEventCard: (item: EventWithMeta, index: number) => void;
  onListRef?: (type: SearchType, node: AppFlatListRef<SearchResultItem> | null) => void;
  onOpenProfile: (profile: SearchProfileSummaryInput) => void;
  onRefresh: () => void;
  onScrollOffsetChange?: (type: SearchType, offset: number) => void;
  prefetchEventById: (eventId: string) => unknown;
  prefetchProfileByUsername: (username: string) => unknown;
  preview?: boolean;
  refreshing: boolean;
  type: SearchType;
  viewportPrefetch: ViewportPrefetch<SearchResultItem>;
};

const NOOP = () => undefined;

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
  onListRef,
  onRefresh,
  onScrollOffsetChange,
  onViewableItemsChanged,
  refreshing,
  renderCard,
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
      paddingTop: tokens.spacing.xs,
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
  const setListNode = useCallback(
    (node: AppFlatListRef<T> | null) => {
      onListRef?.(node as unknown as AppFlatListRef<SearchResultItem> | null);
      if (listRef) {
        (listRef as unknown as React.MutableRefObject<AppFlatListRef<T> | null>).current = node;
      }
    },
    [listRef, onListRef],
  );
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onScrollOffsetChange?.(event.nativeEvent.contentOffset.y);
    },
    [onScrollOffsetChange],
  );

  return (
    <AppFlatList
      ref={setListNode}
      alwaysBounceVertical
      columnWrapperStyle={columnWrapperStyle}
      contentContainerStyle={contentContainerStyle}
      data={data}
      emptyText={emptyText}
      error={currentError}
      estimatedItemSize={grid.cardHeight + grid.rowGap}
      getItemType={() => "search-grid-card"}
      hasMore={hasMore}
      key={listKey}
      keyExtractor={(item, index) => String(item?.id || index)}
      loading={currentLoading}
      loadingComponent={loadingComponent}
      loadingMore={loadingMore}
      numColumns={numColumns}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.82}
      onRefresh={onRefresh}
      onScroll={onScrollOffsetChange ? handleScroll : undefined}
      onViewableItemsChanged={onViewableItemsChanged}
      overScrollMode="always"
      performanceTier="tier1"
      refreshing={refreshing}
      renderItem={renderItem}
      scrollEventThrottle={onScrollOffsetChange ? 16 : undefined}
      showsVerticalScrollIndicator={false}
      style={{ flex: 1 }}
      viewabilityConfig={viewabilityConfig}
    />
  );
}

export function SearchResultsContent(props: SearchResultsContentProps) {
  const {
    grid,
    onListRef,
    onOpenAlbumCard,
    onOpenEventCard,
    onOpenProfile,
    onScrollOffsetChange,
    prefetchEventById,
    prefetchProfileByUsername,
    preview = false,
    type,
  } = props;
  const previewRef = useRef(preview);
  const viewabilityCallbackRef = useRef(props.viewportPrefetch.onViewableItemsChanged);
  const viewabilityConfigRef = useRef(props.viewportPrefetch.viewabilityConfig);
  previewRef.current = preview;
  viewabilityCallbackRef.current = props.viewportPrefetch.onViewableItemsChanged;
  const stableOnViewableItemsChanged = useRef((info: ViewabilityInfo<SearchResultItem>) => {
    if (previewRef.current) return;
    viewabilityCallbackRef.current?.(info);
  }).current;
  const listKey = useMemo(
    () => `${type}-${grid.cardWidth}-${grid.cardHeight}`,
    [grid.cardHeight, grid.cardWidth, type],
  );
  const handleListRef = useCallback(
    (node: AppFlatListRef<SearchResultItem> | null) => {
      onListRef?.(type, node);
    },
    [onListRef, type],
  );
  const handleScrollOffsetChange = useCallback(
    (offset: number) => {
      onScrollOffsetChange?.(type, offset);
    },
    [onScrollOffsetChange, type],
  );
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
  const sharedProps = {
    bottomPadding: props.bottomPadding,
    currentError: preview ? null : props.currentError,
    currentLoading: preview ? false : props.currentLoading,
    emptyText: props.emptyText,
    grid: props.grid,
    hasMore: preview ? false : props.hasMore,
    listRef: preview ? undefined : props.listRef,
    loadingMore: preview ? false : props.loadingMore,
    numColumns: props.numColumns,
    onEndReached: preview ? NOOP : props.onEndReached,
    onListRef: onListRef ? handleListRef : undefined,
    onRefresh: preview ? NOOP : props.onRefresh,
    onScrollOffsetChange: !preview && onScrollOffsetChange ? handleScrollOffsetChange : undefined,
    onViewableItemsChanged: stableOnViewableItemsChanged,
    refreshing: preview ? false : props.refreshing,
    viewabilityConfig: viewabilityConfigRef.current,
  };

  if (type === "albums") {
    return (
      <SearchResultsGrid
        {...sharedProps}
        currentLoading={preview ? false : props.currentLoading}
        data={props.filteredAlbums}
        listKey={listKey}
        renderCard={renderAlbumCard}
      />
    );
  }
  if (type === "events") {
    return (
      <SearchResultsGrid
        {...sharedProps}
        currentLoading={preview ? false : props.currentLoading}
        data={props.filteredEvents}
        listKey={listKey}
        renderCard={renderEventCard}
      />
    );
  }

  const userItems = type === "clubs" ? props.filteredClubs : props.filteredStudents;
  return (
    <SearchResultsGrid
      {...sharedProps}
      currentLoading={preview ? false : props.currentLoading}
      data={userItems}
      listKey={listKey}
      renderCard={renderUserCard}
    />
  );
}
