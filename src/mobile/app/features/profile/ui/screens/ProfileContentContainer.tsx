import { memo, useCallback, useEffect, useMemo, useRef, type ReactElement } from "react";
import type { ViewToken } from "@shopify/flash-list";
import {
  FlatList,
  RefreshControl,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import {
  AppListSkeleton,
  AsyncState,
  EmptyState,
  LoadingSpinner,
} from "../../../../shared/components";
import { t } from "../../../../shared/i18n";
import { useBottomNavPadding } from "../../../../shared/layout/bottomNavSpacing";
import { tokens } from "../../../../shared/theme";
import type { ProfileTab } from "../../domain/profileConstants";
import type { ProfileTileItem } from "../../application/profileUiModels";
import { ProfileTileCard } from "./ProfileTileCard";

const PROFILE_PAGER_TABS: ProfileTab[] = ["album", "events"];
const PROFILE_OUTER_DATA = ["profile-content"] as const;

type Props = {
  albumData?: ProfileTileItem[];
  albumsError: boolean;
  albumsLoading: boolean;
  cardHeight?: number;
  cardWidth?: number;
  emptyText: string;
  eventData?: ProfileTileItem[];
  eventsError: boolean;
  eventsLoading: boolean;
  gridHorizontalPadding?: number;
  gridRowGap?: number;
  hasMore?: boolean;
  header: ReactElement | null;
  loadingMore?: boolean;
  mediaHeight?: number;
  numColumns: number;
  onLoadMore?: () => void;
  onOpenAlbumAt: (item: ProfileTileItem, index: number) => void;
  onOpenEventAt: (item: ProfileTileItem, index: number) => void;
  onOpenProfile: (username: string) => void;
  onPrefetchEvent?: (eventId: string) => void;
  onPrefetchProfile?: (username: string) => void;
  onRefresh?: () => Promise<void> | void;
  onSetTab?: (tab: ProfileTab) => void;
  onViewableItemsChanged?: (info: {
    changed: ViewToken<ProfileTileItem>[];
    viewableItems: ViewToken<ProfileTileItem>[];
  }) => void;
  pagerEnabled?: boolean;
  profileAccountType: "club" | "student";
  profileOwnerId?: string;
  profileOwnerUsername: string;
  refreshing?: boolean;
  tab: ProfileTab;
  tileData: ProfileTileItem[];
  tourTargetIndex?: number;
  viewabilityConfig?: Record<string, unknown>;
};

export const ProfileContentContainer = memo(function ProfileContentContainer({
  albumData,
  albumsError,
  albumsLoading,
  cardHeight,
  cardWidth,
  emptyText,
  eventData,
  eventsError,
  eventsLoading,
  gridHorizontalPadding = 10,
  gridRowGap = 8,
  hasMore = undefined,
  header,
  loadingMore = false,
  mediaHeight,
  numColumns,
  onLoadMore,
  onOpenAlbumAt,
  onOpenEventAt,
  onOpenProfile,
  onPrefetchEvent,
  onPrefetchProfile,
  onRefresh,
  onSetTab,
  onViewableItemsChanged,
  pagerEnabled = true,
  profileAccountType,
  profileOwnerId,
  profileOwnerUsername,
  refreshing = false,
  tab,
  tileData,
  tourTargetIndex,
}: Props) {
  const bottomPadding = useBottomNavPadding(12, 28);
  const loadMoreTokenRef = useRef<string | null>(null);
  const pagerRef = useRef<FlatList<ProfileTab> | null>(null);
  const didMountRef = useRef(false);
  const { width } = useWindowDimensions();
  const pageWidth = Math.max(1, width);
  const activeIndex = Math.max(0, PROFILE_PAGER_TABS.indexOf(tab));
  const contentContainerStyle = useMemo(
    () => ({
      flexGrow: 1,
      paddingBottom: bottomPadding,
    }),
    [bottomPadding],
  );
  const pageContentStyle = useMemo(
    () => ({
      paddingHorizontal: gridHorizontalPadding,
      paddingTop: 8,
      paddingBottom: bottomPadding,
    }),
    [bottomPadding, gridHorizontalPadding],
  );
  const activeData = useMemo(
    () => (tab === "album" ? (albumData ?? tileData) : (eventData ?? tileData)),
    [albumData, eventData, tab, tileData],
  );
  const activeLoading = tab === "album" ? albumsLoading : eventsLoading;
  const activeError = tab === "album" ? albumsError : eventsError;
  const resolvedCardHeight = cardHeight || (numColumns === 3 ? 156 : 196);
  const resolvePageData = useCallback(
    (pageTab: ProfileTab) =>
      pageTab === "album"
        ? (albumData ?? (tab === "album" ? tileData : []))
        : (eventData ?? (tab === "events" ? tileData : [])),
    [albumData, eventData, tab, tileData],
  );
  const resolvePageHeight = useCallback(
    (pageTab: ProfileTab) => {
      const pageData = resolvePageData(pageTab);
      const pageLoading = pageTab === "album" ? albumsLoading : eventsLoading;
      const pageError = pageTab === "album" ? albumsError : eventsError;
      if (pageLoading && pageData.length === 0) {
        return Math.max(360, resolvedCardHeight * 3 + gridRowGap * 2 + bottomPadding + 24);
      }
      if (pageError || pageData.length === 0) {
        return Math.max(260, Math.round(pageWidth * 0.62));
      }
      const rows = Math.ceil(pageData.length / Math.max(1, numColumns));
      return (
        8 + rows * resolvedCardHeight + Math.max(0, rows - 1) * gridRowGap + bottomPadding + 56
      );
    },
    [
      albumsError,
      albumsLoading,
      bottomPadding,
      eventsError,
      eventsLoading,
      gridRowGap,
      numColumns,
      pageWidth,
      resolvePageData,
      resolvedCardHeight,
    ],
  );
  const pagerHeight = resolvePageHeight(tab);
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
  useEffect(() => {
    loadMoreTokenRef.current = null;
  }, [activeData.length, tab]);
  useEffect(() => {
    if (!onViewableItemsChanged || activeLoading || activeError || activeData.length === 0) return;
    const limit = Math.min(activeData.length, Math.max(numColumns * 3, 6));
    const viewableItems = activeData.slice(0, limit).map(
      (item, index) =>
        ({
          index,
          isViewable: true,
          item,
          key: String(item?.id || index),
        }) as ViewToken<ProfileTileItem>,
    );
    onViewableItemsChanged({ changed: viewableItems, viewableItems });
  }, [activeData, activeError, activeLoading, numColumns, onViewableItemsChanged]);
  const renderTile = useCallback(
    (pageTab: ProfileTab, item: ProfileTileItem, index: number) => (
      <ProfileTileCard
        cardHeight={cardHeight}
        cardWidth={cardWidth}
        item={item}
        mediaHeight={mediaHeight}
        numColumns={numColumns}
        onOpenAlbum={() => onOpenAlbumAt(item, index)}
        onOpenEvent={() => onOpenEventAt(item, index)}
        onPrefetchEvent={onPrefetchEvent}
        onPrefetchProfile={onPrefetchProfile}
        onOpenProfile={onOpenProfile}
        profileAccountType={profileAccountType}
        profileOwnerUserId={profileOwnerId}
        profileOwnerUsername={profileOwnerUsername}
        isTourTarget={index === tourTargetIndex}
        tab={pageTab}
      />
    ),
    [
      cardHeight,
      cardWidth,
      mediaHeight,
      numColumns,
      onOpenAlbumAt,
      onOpenEventAt,
      onOpenProfile,
      onPrefetchEvent,
      onPrefetchProfile,
      profileAccountType,
      profileOwnerId,
      profileOwnerUsername,
      tourTargetIndex,
    ],
  );
  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = Math.max(
        0,
        Math.min(
          PROFILE_PAGER_TABS.length - 1,
          Math.round(event.nativeEvent.contentOffset.x / pageWidth),
        ),
      );
      const nextTab = PROFILE_PAGER_TABS[nextIndex];
      if (nextTab && nextTab !== tab) {
        onSetTab?.(nextTab);
      }
    },
    [onSetTab, pageWidth, tab],
  );
  const handleOuterEndReached = useCallback(() => {
    if (
      !onLoadMore ||
      loadingMore ||
      refreshing ||
      hasMore === false ||
      activeLoading ||
      activeData.length === 0
    ) {
      return;
    }
    const token = `${tab}:${activeData.length}`;
    if (loadMoreTokenRef.current === token) return;
    loadMoreTokenRef.current = token;
    onLoadMore();
  }, [activeData.length, activeLoading, hasMore, loadingMore, onLoadMore, refreshing, tab]);
  const renderFooter = useCallback(
    (isActive: boolean, dataLength: number) => {
      if (!isActive || dataLength === 0) return null;
      if (loadingMore) {
        return (
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 14 }}>
            <LoadingSpinner size="small" />
            <Text style={{ color: tokens.colors.muted, fontSize: tokens.typography.caption }}>
              {t("common.loading")}
            </Text>
          </View>
        );
      }
      if (hasMore === false) {
        return (
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 14 }}>
            <Text style={{ color: tokens.colors.muted, fontSize: tokens.typography.caption }}>
              {t("common.list.end")}
            </Text>
          </View>
        );
      }
      return null;
    },
    [hasMore, loadingMore],
  );
  const renderGridRows = useCallback(
    (pageTab: ProfileTab, data: ProfileTileItem[]) => {
      const rows: ProfileTileItem[][] = [];
      for (let index = 0; index < data.length; index += numColumns) {
        rows.push(data.slice(index, index + numColumns));
      }
      return rows.map((row, rowIndex) => (
        <View
          key={`${pageTab}:row:${rowIndex}`}
          style={{
            flexDirection: "row",
            gap: gridRowGap,
            marginBottom: rowIndex === rows.length - 1 ? 0 : gridRowGap,
          }}
        >
          {row.map((item, columnIndex) => {
            const itemIndex = rowIndex * numColumns + columnIndex;
            return (
              <View key={`${pageTab}:${String(item?.id || itemIndex)}`}>
                {renderTile(pageTab, item, itemIndex)}
              </View>
            );
          })}
        </View>
      ));
    },
    [gridRowGap, numColumns, renderTile],
  );
  const renderPage = useCallback(
    ({ item: pageTab }: { item: ProfileTab }) => {
      const isActive = pageTab === tab;
      const data = resolvePageData(pageTab);
      const loading = pageTab === "album" ? albumsLoading : eventsLoading;
      const error =
        pageTab === "album"
          ? albumsError
            ? t("profile.error.albums")
            : null
          : eventsError
            ? t("profile.error.events")
            : null;
      const pageBody =
        loading && data.length === 0 ? (
          <AppListSkeleton
            columns={numColumns}
            horizontalPadding={0}
            itemHeight={resolvedCardHeight}
            variant="grid"
          />
        ) : error && isActive ? (
          <AsyncState error={error} loading={false}>
            <View />
          </AsyncState>
        ) : data.length === 0 ? (
          <EmptyState title={isActive ? emptyText : ""} />
        ) : (
          <>
            {renderGridRows(pageTab, data)}
            {renderFooter(isActive, data.length)}
          </>
        );
      return (
        <View style={{ width: pageWidth, minHeight: pagerHeight }}>
          <View style={pageContentStyle}>{pageBody}</View>
        </View>
      );
    },
    [
      albumsError,
      albumsLoading,
      emptyText,
      eventsError,
      eventsLoading,
      numColumns,
      pageWidth,
      pageContentStyle,
      pagerHeight,
      renderFooter,
      renderGridRows,
      resolvePageData,
      resolvedCardHeight,
      tab,
    ],
  );
  const renderPager = useCallback(
    () => (
      <FlatList
        ref={pagerRef}
        data={PROFILE_PAGER_TABS}
        extraData={`${tab}:${activeData.length}:${pagerHeight}:${loadingMore}`}
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
        scrollEnabled={pagerEnabled && Boolean(onSetTab)}
        showsHorizontalScrollIndicator={false}
        style={{ height: pagerHeight }}
        windowSize={2}
      />
    ),
    [
      activeData.length,
      activeIndex,
      handleMomentumScrollEnd,
      loadingMore,
      onSetTab,
      pageWidth,
      pagerEnabled,
      pagerHeight,
      renderPage,
      tab,
    ],
  );
  return (
    <FlatList
      alwaysBounceVertical
      contentContainerStyle={contentContainerStyle}
      data={PROFILE_OUTER_DATA}
      keyExtractor={(item) => item}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      nestedScrollEnabled
      onEndReached={handleOuterEndReached}
      onEndReachedThreshold={0.72}
      overScrollMode="always"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            onRefresh={() => {
              void onRefresh();
            }}
            refreshing={refreshing}
            tintColor={tokens.colors.primary}
          />
        ) : undefined
      }
      renderItem={renderPager}
      showsVerticalScrollIndicator={false}
      style={{ flex: 1 }}
    />
  );
});
