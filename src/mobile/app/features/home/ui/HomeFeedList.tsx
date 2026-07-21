import { useCallback, useMemo, type ReactElement, type RefObject } from "react";
import type { ViewToken } from "@shopify/flash-list";
import { AppFlatList, AppListSkeleton, type AppFlatListRef } from "../../../shared/components";
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

function getFeedItemType<TItem extends FeedListItem>(item: TItem) {
  return item.kind;
}

interface HomeFeedListProps<TItem extends FeedListItem> {
  bottomPadding: number;
  data: TItem[];
  errorMessage?: string | null;
  hasMore?: boolean;
  listRef: RefObject<AppFlatListRef<TItem> | null>;
  loadState: { isBlocking: boolean };
  loadingMore: boolean;
  onEndReached: () => void;
  onFirstDraw?: (elapsedTimeInMs: number) => void;
  onRefresh: () => Promise<void> | void;
  onUserInteraction?: () => void;
  onViewableItemsChanged?: (info: ViewabilityInfo<TItem>) => void;
  refreshing: boolean;
  renderFeedItem: (item: TItem, index: number) => ReactElement;
  viewabilityConfig?: Record<string, unknown>;
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
  onFirstDraw,
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
      paddingBottom: bottomPadding,
      paddingHorizontal: 0,
      paddingTop: tokens.spacing.xs,
    }),
    [bottomPadding],
  );
  const loadingComponent = useMemo(
    () => <AppListSkeleton count={3} itemHeight={308} variant="list" />,
    [],
  );
  const renderListItem = useCallback(
    ({ index, item }: { index: number; item: TItem }) => renderFeedItem(item, index),
    [renderFeedItem],
  );
  const handleFirstDraw = useCallback(
    (info: { elapsedTimeInMs: number }) => {
      onFirstDraw?.(info.elapsedTimeInMs);
    },
    [onFirstDraw],
  );

  return (
    <AppFlatList
      ref={listRef}
      contentContainerStyle={listContentStyle}
      data={data}
      emptySubtitle={t("home.empty.subtitle")}
      emptyTitle={t("home.empty.title")}
      error={data.length === 0 ? errorMessage || null : null}
      estimatedItemSize={332}
      getItemType={getFeedItemType}
      hasMore={hasMore}
      keyExtractor={getFeedItemKey}
      loading={loadState.isBlocking && data.length === 0}
      loadingComponent={loadingComponent}
      loadingMore={loadingMore}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.78}
      onLoad={handleFirstDraw}
      onRefresh={onRefresh}
      onScrollBeginDrag={onUserInteraction}
      onTouchStart={onUserInteraction}
      onViewableItemsChanged={onViewableItemsChanged}
      performanceTier="tier1"
      refreshing={refreshing}
      renderItem={renderListItem}
      viewabilityConfig={viewabilityConfig}
    />
  );
}
