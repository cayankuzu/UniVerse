import type { ViewToken } from "@shopify/flash-list";
import { useCallback, useMemo, type ReactElement, type RefObject } from "react";
import { AppFlatList, type AppFlatListRef } from "../../../shared/components";
import { t } from "../../../shared/i18n";

type FeedListItem = {
  id: string | number;
  kind: string;
};

type ViewabilityInfo<TItem> = {
  changed: ViewToken<TItem>[];
  viewableItems: ViewToken<TItem>[];
};

function getFeedItemType<TItem extends FeedListItem>(item: TItem) {
  return item.kind;
}

function getFeedItemKey<TItem extends FeedListItem>(item: TItem) {
  return `${item.kind}-${item.id}`;
}

interface HomeFeedListProps<TItem extends FeedListItem> {
  data: TItem[];
  errorMessage?: string | null;
  hasMore?: boolean;
  listRef: RefObject<AppFlatListRef<TItem> | null>;
  loadState: { isBlocking: boolean };
  loadingMore: boolean;
  onEndReached: () => void;
  onRefresh: () => Promise<void> | void;
  onUserInteraction?: () => void;
  onViewableItemsChanged?: (info: ViewabilityInfo<TItem>) => void;
  refreshing: boolean;
  renderFeedItem: (item: TItem, index: number) => ReactElement;
  viewabilityConfig?: Record<string, unknown>;
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

  return (
    <AppFlatList
      ref={listRef}
      data={data}
      emptySubtitle={t("home.empty.subtitle")}
      emptyTitle={t("home.empty.title")}
      estimatedItemSize={332}
      error={data.length === 0 ? errorMessage || null : null}
      getItemType={getFeedItemType}
      hasMore={hasMore}
      keyExtractor={getFeedItemKey}
      loading={loadState.isBlocking}
      loadingMore={loadingMore}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.78}
      onRefresh={onRefresh}
      onScrollBeginDrag={onUserInteraction}
      onTouchStart={onUserInteraction}
      onViewableItemsChanged={onViewableItemsChanged}
      performanceTier="tier1"
      refreshing={refreshing}
      contentContainerStyle={listContentStyle}
      renderItem={renderListItem}
      viewabilityConfig={viewabilityConfig}
    />
  );
}
