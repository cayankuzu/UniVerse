import { FlashList, type FlashListProps, type FlashListRef } from "@shopify/flash-list";
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ForwardedRef,
  type ComponentType,
  type ReactElement,
} from "react";
import type {
  ListRenderItem,
  GestureResponderEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControlProps,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Platform, RefreshControl, StyleSheet, Text, View } from "react-native";
import { tokens } from "../../shared/theme";
import { t } from "../../shared/i18n";
import {
  resolveListPerformanceBudget,
  type PerformanceTier,
} from "../performance/performanceBudget";
import { beginInteractionScope, noteInteractionActive } from "../performance/interactionGate";
import {
  resolveRuntimePerformanceTier,
  useRuntimePerformanceTier,
} from "../performance/runtimePerformanceTier";
import { AsyncState } from "./AsyncState";
import { AppListSkeleton } from "./AppListSkeleton";
import { EmptyState } from "./EmptyState";
import { LoadingSpinner } from "./LoadingSpinner";

type BaseFlatListProps<T> = Omit<
  FlashListProps<T>,
  "ListEmptyComponent" | "onRefresh" | "refreshing" | "renderItem"
>;

export type AppFlatListRef<T> = FlashListRef<T>;

export interface AppFlatListProps<T> extends BaseFlatListProps<T> {
  columnWrapperStyle?: StyleProp<ViewStyle>;
  endReachedText?: string;
  estimatedItemSize?: number;
  emptyText?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
  error?: string | null;
  hasMore?: boolean;
  ListEmptyComponent?: ComponentType<Record<string, never>> | ReactElement | null;
  loading?: boolean;
  loadingMore?: boolean;
  loadingComponent?: ReactElement | null;
  onRefresh?: () => Promise<void> | void;
  performanceTier?: PerformanceTier;
  refreshColor?: string;
  refreshing?: boolean;
  refreshProps?: Partial<RefreshControlProps>;
  renderItem: ListRenderItem<T>;
}

function buildDefaultEmptyState(params: {
  emptySubtitle?: string;
  emptyText?: string;
  emptyTitle?: string;
  error?: string | null;
  estimatedItemSize: number;
  loading?: boolean;
  loadingComponent?: ReactElement | null;
  numColumns: number;
}) {
  if (params.loading) {
    if (params.loadingComponent) {
      return params.loadingComponent;
    }

    return (
      <AppListSkeleton
        columns={params.numColumns}
        count={
          params.numColumns > 1 ? params.numColumns * 3 : params.estimatedItemSize > 220 ? 3 : 6
        }
        itemHeight={
          params.numColumns > 1
            ? Math.max(128, params.estimatedItemSize - 40)
            : Math.max(72, params.estimatedItemSize - 24)
        }
        variant={params.numColumns > 1 ? "grid" : "list"}
      />
    );
  }

  if (params.error) {
    return (
      <AsyncState error={params.error} loading={false}>
        <View />
      </AsyncState>
    );
  }

  if (!params.emptyText && !params.emptyTitle && !params.emptySubtitle) return null;

  const resolvedTitle = params.emptyTitle ?? params.emptyText ?? t("common.empty.title");
  const resolvedSubtitle = params.emptyTitle
    ? params.emptySubtitle
    : (params.emptySubtitle ?? (params.emptyText ? undefined : t("common.empty.subtitle")));

  return <EmptyState title={resolvedTitle} subtitle={resolvedSubtitle} />;
}

function buildDefaultFooter(params: {
  dataLength: number;
  endReachedText?: string;
  hasMore?: boolean;
  loadingMore?: boolean;
}) {
  if (params.dataLength === 0) return null;

  if (params.loadingMore) {
    return (
      <View style={styles.footer}>
        <LoadingSpinner size="small" />
        <Text style={styles.footerText}>{t("common.loading")}</Text>
      </View>
    );
  }

  if (params.hasMore === false) {
    return (
      <View style={styles.footer}>
        <Text style={styles.footerText}>{params.endReachedText || t("common.list.end")}</Text>
      </View>
    );
  }

  return null;
}

function AppFlatListInner<T>(
  {
    data,
    drawDistance,
    columnWrapperStyle,
    endReachedText,
    emptyText,
    emptyTitle,
    emptySubtitle,
    estimatedItemSize,
    error = null,
    hasMore,
    ListEmptyComponent,
    ListFooterComponent,
    loading = false,
    loadingMore = false,
    loadingComponent = null,
    directionalLockEnabled = true,
    keyboardDismissMode = Platform.OS === "ios" ? "interactive" : "on-drag",
    keyboardShouldPersistTaps = "handled",
    nestedScrollEnabled = true,
    onContentSizeChange,
    onEndReached,
    onEndReachedThreshold,
    onLayout,
    onMomentumScrollBegin,
    onMomentumScrollEnd,
    onRefresh,
    onScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    onTouchCancel,
    onTouchEnd,
    onTouchStart,
    performanceTier = "tier1",
    refreshColor = tokens.colors.primary,
    refreshProps,
    refreshing = false,
    removeClippedSubviews = true,
    renderItem,
    scrollEventThrottle,
    showsHorizontalScrollIndicator = false,
    showsVerticalScrollIndicator = false,
    ...rest
  }: AppFlatListProps<T>,
  ref: ForwardedRef<FlashListRef<T>>,
): ReactElement {
  const runtimePerformanceTier = useRuntimePerformanceTier();
  const effectivePerformanceTier = resolveRuntimePerformanceTier(
    performanceTier,
    runtimePerformanceTier,
  );
  const listBudget = resolveListPerformanceBudget(effectivePerformanceTier);
  const flattenedColumnWrapperStyle = StyleSheet.flatten(columnWrapperStyle);
  const resolvedEstimatedItemSize =
    estimatedItemSize ?? (typeof rest.numColumns === "number" && rest.numColumns > 1 ? 216 : 248);
  const listData = data || [];
  const maxDrawDistance = resolvedEstimatedItemSize * listBudget.drawDistanceMultiplier;
  const resolvedDrawDistance = Math.min(drawDistance ?? maxDrawDistance, maxDrawDistance);
  const resolvedColumnGap = Number(flattenedColumnWrapperStyle?.columnGap || 0);
  const resolvedRowGap = Number(flattenedColumnWrapperStyle?.marginBottom || 0);
  const resolvedNumColumns = Number(rest.numColumns || 1);
  const resolvedScrollEventThrottle = scrollEventThrottle ?? (onScroll ? 16 : undefined);
  const interactionScopeRef = useRef<(() => void) | null>(null);
  const endReachedDataLengthRef = useRef<number | null>(null);

  const beginListInteraction = useCallback(() => {
    noteInteractionActive(240);
    if (interactionScopeRef.current) return;
    interactionScopeRef.current = beginInteractionScope({
      holdMs: 420,
      releaseMs: 240,
    });
  }, []);

  const endListInteraction = useCallback(() => {
    interactionScopeRef.current?.();
    interactionScopeRef.current = null;
  }, []);

  useEffect(
    () => () => {
      endListInteraction();
    },
    [endListInteraction],
  );

  const resolvedEmptyComponent = useMemo(
    () =>
      ListEmptyComponent ??
      buildDefaultEmptyState({
        emptySubtitle,
        emptyText,
        emptyTitle,
        error,
        estimatedItemSize: resolvedEstimatedItemSize,
        loading,
        loadingComponent,
        numColumns: resolvedNumColumns,
      }),
    [
      ListEmptyComponent,
      emptySubtitle,
      emptyText,
      emptyTitle,
      error,
      loading,
      loadingComponent,
      resolvedEstimatedItemSize,
      resolvedNumColumns,
    ],
  );
  const resolvedFooterComponent = useMemo(
    () =>
      ListFooterComponent ??
      buildDefaultFooter({
        dataLength: listData.length,
        endReachedText,
        hasMore,
        loadingMore,
      }),
    [ListFooterComponent, endReachedText, hasMore, listData.length, loadingMore],
  );
  const handleRefresh = useCallback(() => {
    noteInteractionActive(220);
    void onRefresh?.();
  }, [onRefresh]);
  useEffect(() => {
    if (endReachedDataLengthRef.current !== listData.length) {
      endReachedDataLengthRef.current = null;
    }
  }, [listData.length]);
  const refreshControl = useMemo(
    () =>
      onRefresh ? (
        <RefreshControl
          {...refreshProps}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          tintColor={refreshColor}
        />
      ) : undefined,
    [handleRefresh, onRefresh, refreshColor, refreshProps, refreshing],
  );
  const handleMomentumScrollBegin = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      beginListInteraction();
      onMomentumScrollBegin?.(event);
    },
    [beginListInteraction, onMomentumScrollBegin],
  );
  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      noteInteractionActive(120);
      endListInteraction();
      onMomentumScrollEnd?.(event);
    },
    [endListInteraction, onMomentumScrollEnd],
  );
  const handleScrollBeginDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      beginListInteraction();
      onScrollBeginDrag?.(event);
    },
    [beginListInteraction, onScrollBeginDrag],
  );
  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      noteInteractionActive(140);
      endListInteraction();
      onScrollEndDrag?.(event);
    },
    [endListInteraction, onScrollEndDrag],
  );
  const handleTouchCancel = useCallback(
    (event: GestureResponderEvent) => {
      noteInteractionActive(120);
      endListInteraction();
      onTouchCancel?.(event);
    },
    [endListInteraction, onTouchCancel],
  );
  const handleTouchEnd = useCallback(
    (event: GestureResponderEvent) => {
      noteInteractionActive(140);
      onTouchEnd?.(event);
    },
    [onTouchEnd],
  );
  const handleTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      noteInteractionActive(180);
      onTouchStart?.(event);
    },
    [onTouchStart],
  );
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onScroll?.(event);
    },
    [onScroll],
  );
  const handleEndReached = useCallback(() => {
    if (
      !onEndReached ||
      rest.horizontal ||
      loading ||
      loadingMore ||
      refreshing ||
      hasMore === false ||
      listData.length === 0 ||
      endReachedDataLengthRef.current === listData.length
    ) {
      return;
    }

    endReachedDataLengthRef.current = listData.length;
    noteInteractionActive(180);
    onEndReached();
  }, [hasMore, listData.length, loading, loadingMore, onEndReached, refreshing, rest.horizontal]);
  const wrappedRenderItem = useCallback(
    ({ index, item }: { index: number; item: T }) => {
      const content = renderItem({
        index,
        item,
        separators: {
          highlight: () => undefined,
          unhighlight: () => undefined,
          updateProps: () => undefined,
        },
      });
      if (!content) return null;
      if (resolvedNumColumns <= 1) return content;
      const isRowEnd = (index + 1) % resolvedNumColumns === 0;
      return (
        <View
          style={{ marginBottom: resolvedRowGap, marginRight: isRowEnd ? 0 : resolvedColumnGap }}
        >
          {content}
        </View>
      );
    },
    [renderItem, resolvedColumnGap, resolvedNumColumns, resolvedRowGap],
  );

  return (
    <FlashList<T>
      {...rest}
      data={listData}
      ref={ref}
      alwaysBounceVertical
      drawDistance={resolvedDrawDistance}
      directionalLockEnabled={directionalLockEnabled}
      keyboardDismissMode={keyboardDismissMode}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      ListEmptyComponent={resolvedEmptyComponent}
      ListFooterComponent={resolvedFooterComponent}
      nestedScrollEnabled={nestedScrollEnabled}
      overScrollMode="always"
      onContentSizeChange={onContentSizeChange}
      onEndReached={handleEndReached}
      onEndReachedThreshold={onEndReachedThreshold}
      onMomentumScrollBegin={handleMomentumScrollBegin}
      onMomentumScrollEnd={handleMomentumScrollEnd}
      onLayout={onLayout}
      refreshControl={refreshControl}
      removeClippedSubviews={removeClippedSubviews}
      onScroll={onScroll ? handleScroll : undefined}
      onScrollBeginDrag={handleScrollBeginDrag}
      onScrollEndDrag={handleScrollEndDrag}
      onTouchCancel={handleTouchCancel}
      onTouchEnd={handleTouchEnd}
      onTouchStart={handleTouchStart}
      renderItem={wrappedRenderItem}
      scrollEventThrottle={resolvedScrollEventThrottle}
      showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
    />
  );
}

export const AppFlatList = forwardRef(AppFlatListInner) as <T>(
  props: AppFlatListProps<T> & { ref?: ForwardedRef<FlashListRef<T>> },
) => ReactElement;

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
