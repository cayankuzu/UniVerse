import { useCallback, useEffect, useMemo, useRef, type ReactElement, type RefObject } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  type ViewabilityConfig,
  type ViewToken,
} from "react-native";
import { AppListSkeleton } from "../../../shared/components/AppListSkeleton";
import { AsyncState } from "../../../shared/components/AsyncState";
import { LoadingSpinner } from "../../../shared/components/LoadingSpinner";
import { t } from "../../../shared/i18n";
import { tokens } from "../../../shared/theme";

type FeedListItem = {
  id: string | number;
  kind: string;
};

type ViewabilityInfo<TItem> = {
  changed: ViewToken<TItem>[];
  viewableItems: ViewToken<TItem>[];
};

function getFeedItemKey<TItem extends FeedListItem>(item: TItem) {
  return `${item.kind}-${item.id}`;
}

interface HomeFeedListProps<TItem extends FeedListItem> {
  data: TItem[];
  errorMessage?: string | null;
  hasMore?: boolean;
  listRef: RefObject<FlatList<TItem> | null>;
  loadState: { isBlocking: boolean };
  loadingMore: boolean;
  onEndReached: () => void;
  onRefresh: () => Promise<void> | void;
  onUserInteraction?: () => void;
  onViewableItemsChanged?: (info: ViewabilityInfo<TItem>) => void;
  refreshing: boolean;
  renderFeedItem: (item: TItem, index: number) => ReactElement;
  viewabilityConfig?: ViewabilityConfig;
  bottomPadding: number;
}

export function HomeFeedList<TItem extends FeedListItem>({
  bottomPadding,
  data,
  errorMessage,
  hasMore,
  listRef,
  loadState,
  loadingMore,
  onEndReached,
  onRefresh,
  onUserInteraction,
  onViewableItemsChanged,
  refreshing,
  renderFeedItem,
  viewabilityConfig,
}: HomeFeedListProps<TItem>) {
  const endReachedDataLengthRef = useRef<number | null>(null);
  const listContentStyle = useMemo(
    () => ({
      flexGrow: 1 as const,
      paddingHorizontal: 0,
      paddingTop: 8,
      paddingBottom: bottomPadding,
    }),
    [bottomPadding],
  );
  const renderListItem = useCallback(
    ({ item, index }: { index: number; item: TItem }) => renderFeedItem(item, index),
    [renderFeedItem],
  );
  const emptyComponent = useMemo(
    () => (
      <AsyncState
        empty={!loadState.isBlocking && !errorMessage}
        emptySubtitle={t("home.empty.subtitle")}
        emptyTitle={t("home.empty.title")}
        error={errorMessage}
        loading={loadState.isBlocking}
        loadingFallback={<AppListSkeleton count={3} itemHeight={308} variant="list" />}
      />
    ),
    [errorMessage, loadState.isBlocking],
  );
  const footerComponent = useMemo(() => {
    if (data.length === 0) return null;
    if (loadingMore) {
      return (
        <View style={styles.footer}>
          <LoadingSpinner size="small" />
          <Text style={styles.footerText}>{t("common.loading")}</Text>
        </View>
      );
    }
    if (hasMore === false) {
      return (
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t("common.list.end")}</Text>
        </View>
      );
    }
    return null;
  }, [data.length, hasMore, loadingMore]);

  useEffect(() => {
    if (endReachedDataLengthRef.current !== data.length) {
      endReachedDataLengthRef.current = null;
    }
  }, [data.length]);

  const handleEndReached = useCallback(() => {
    if (
      loadState.isBlocking ||
      loadingMore ||
      refreshing ||
      hasMore === false ||
      data.length === 0 ||
      endReachedDataLengthRef.current === data.length
    ) {
      return;
    }
    endReachedDataLengthRef.current = data.length;
    onEndReached();
  }, [data.length, hasMore, loadState.isBlocking, loadingMore, onEndReached, refreshing]);
  const handleRefresh = useCallback(() => {
    void onRefresh();
  }, [onRefresh]);

  return (
    <FlatList
      ref={listRef}
      contentContainerStyle={listContentStyle}
      data={data}
      initialNumToRender={3}
      keyExtractor={getFeedItemKey}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={emptyComponent}
      ListFooterComponent={footerComponent}
      maxToRenderPerBatch={3}
      nestedScrollEnabled
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.78}
      onRefresh={handleRefresh}
      onScrollBeginDrag={onUserInteraction}
      onTouchStart={onUserInteraction}
      onViewableItemsChanged={onViewableItemsChanged}
      refreshing={refreshing}
      removeClippedSubviews
      renderItem={renderListItem}
      showsVerticalScrollIndicator={false}
      updateCellsBatchingPeriod={32}
      viewabilityConfig={viewabilityConfig}
      windowSize={5}
    />
  );
}

const styles = StyleSheet.create({
  footer: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
  },
  footerText: {
    color: tokens.colors.muted,
    fontSize: tokens.typography.caption,
    textAlign: "center",
  },
});
