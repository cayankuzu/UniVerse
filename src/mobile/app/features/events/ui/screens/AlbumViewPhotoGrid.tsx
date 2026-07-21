import React, { useCallback, useMemo } from "react";
import { View } from "react-native";
import { DiscoveryAlbumGridCard } from "../../../../features/content-cards/public/cards";
import { buildPreparedAlbumVisibility } from "../../../content-cards/public/presentation";
import { AppFlatList, AppListSkeleton } from "../../../../shared/components";
import { isPendingPhoto, type PendingAlbumPhoto } from "../../data/albumUploadQueueRepository";
import type { AlbumEventProjectionItem } from "../../data/albumProjection.types";
import { tokens } from "../../../../shared/theme";

type GridMetrics = {
  cardHeight: number;
  cardWidth: number;
  horizontalPadding: number;
  mediaHeight: number;
  rowGap: number;
};

type Props = {
  error: string | null;
  grid: GridMetrics;
  hasMore?: boolean;
  loading: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onOpenPhoto: (index: number) => void;
  onPrefetchEvent?: (eventId: string) => void;
  onRefresh: () => void;
  photos: Array<AlbumEventProjectionItem | PendingAlbumPhoto>;
  refreshing: boolean;
};

export function AlbumViewPhotoGrid({
  error,
  grid,
  hasMore,
  loading,
  loadingMore,
  onLoadMore,
  onOpenPhoto,
  onPrefetchEvent,
  onRefresh,
  photos,
  refreshing,
}: Props) {
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
      paddingBottom: tokens.spacing.mdPlus,
    }),
    [grid.horizontalPadding],
  );
  const loadingComponent = useMemo(
    () => (
      <AppListSkeleton
        columns={2}
        horizontalPadding={grid.horizontalPadding}
        itemHeight={grid.cardHeight}
        variant="grid"
      />
    ),
    [grid.cardHeight, grid.horizontalPadding],
  );
  const renderItem = useCallback(
    ({ item, index }: { index: number; item: AlbumEventProjectionItem | PendingAlbumPhoto }) => {
      const visibility = buildPreparedAlbumVisibility(item, "event_album");
      return (
        <View style={{ width: grid.cardWidth }}>
          <DiscoveryAlbumGridCard
            visibility={visibility}
            cardHeight={grid.cardHeight}
            cardWidth={grid.cardWidth}
            item={item}
            mediaHeight={grid.mediaHeight}
            onPrefetchEvent={onPrefetchEvent}
            onPress={() => {
              if (isPendingPhoto(item)) return;
              onOpenPhoto(index);
            }}
          />
        </View>
      );
    },
    [grid.cardHeight, grid.cardWidth, grid.mediaHeight, onOpenPhoto, onPrefetchEvent],
  );

  return (
    <AppFlatList
      alwaysBounceVertical
      columnWrapperStyle={columnWrapperStyle}
      contentContainerStyle={contentContainerStyle}
      data={photos}
      estimatedItemSize={grid.cardHeight + 68}
      error={error}
      getItemType={(item) => (isPendingPhoto(item) ? "pending-photo" : "album-photo")}
      hasMore={hasMore}
      key={`event-albums-${grid.cardWidth}-${grid.cardHeight}`}
      keyExtractor={(item) => item.id}
      loading={loading}
      loadingComponent={loadingComponent}
      loadingMore={loadingMore}
      numColumns={2}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.65}
      onRefresh={onRefresh}
      overScrollMode="always"
      performanceTier="tier2"
      refreshing={refreshing}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
    />
  );
}
