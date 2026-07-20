import { memo, useCallback, useMemo, type ReactElement } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useBottomNavPadding } from "../../../../shared/layout/bottomNavSpacing";
import { tokens } from "../../../../shared/theme";

const PROFILE_OUTER_DATA = ["profile-content"] as const;

type ProfileOuterItem = (typeof PROFILE_OUTER_DATA)[number];
type ScrollToOffsetHandle = {
  scrollToOffset: (params: { animated: boolean; offset: number }) => void;
};

type Props = {
  header: ReactElement;
  listRef?: React.MutableRefObject<unknown>;
  onEndReached?: () => void;
  onRefresh?: () => Promise<void> | void;
  onScrollOffsetChange?: (offset: number) => void;
  pager: ReactElement;
  refreshing?: boolean;
};

const renderPagerItem =
  (pager: ReactElement): ListRenderItem<ProfileOuterItem> =>
  () =>
    pager;

export const ProfilePagedScrollContainer = memo(function ProfilePagedScrollContainer({
  header,
  listRef,
  onEndReached,
  onRefresh,
  onScrollOffsetChange,
  pager,
  refreshing = false,
}: Props) {
  const bottomPadding = useBottomNavPadding(12, 28);
  const contentContainerStyle = useMemo(
    () => [styles.content, { paddingBottom: bottomPadding }],
    [bottomPadding],
  );
  const setListNode = useCallback(
    (node: FlatList<ProfileOuterItem> | null) => {
      if (listRef) {
        (listRef as React.MutableRefObject<ScrollToOffsetHandle | null>).current = node;
      }
    },
    [listRef],
  );
  const handleRefresh = useCallback(() => {
    void onRefresh?.();
  }, [onRefresh]);
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onScrollOffsetChange?.(event.nativeEvent.contentOffset.y);
    },
    [onScrollOffsetChange],
  );

  return (
    <FlatList
      ref={setListNode}
      contentContainerStyle={contentContainerStyle}
      data={PROFILE_OUTER_DATA}
      keyExtractor={(item) => item}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      nestedScrollEnabled
      onEndReached={onEndReached}
      onEndReachedThreshold={0.72}
      onScroll={onScrollOffsetChange ? handleScroll : undefined}
      overScrollMode="always"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            colors={[tokens.colors.primary]}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            tintColor={tokens.colors.primary}
          />
        ) : undefined
      }
      refreshing={refreshing}
      removeClippedSubviews={false}
      renderItem={renderPagerItem(pager)}
      scrollEventThrottle={onScrollOffsetChange ? 16 : undefined}
      showsVerticalScrollIndicator={false}
      style={styles.list}
      testID="profile-outer-scroll"
      windowSize={3}
    />
  );
});

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  list: {
    flex: 1,
  },
});
