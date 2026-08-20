import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  FlatList,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useReducedMotion } from "../hooks/useReducedMotion";

import {
  loadNativePagerView,
  type NativePagerViewHandle,
  type NativePagerViewOnPageScrollEvent,
  type NativePagerViewOnPageScrollStateChangedEvent,
  type NativePagerViewOnPageSelectedEvent,
} from "./pagerViewAdapter";
import {
  resolvePagedScrollIndex,
  shouldRenderPagedItem,
  usePagerController,
  useProgrammaticScrollGuard,
} from "./swipeableTabPagerController";

export {
  clampPageProgress,
  resolvePagedScrollIndex,
  shouldRenderPagedItem,
} from "./swipeableTabPagerController";

type SwipeableTabPagerProps<TTab extends string> = {
  activeTab: TTab;
  enabled?: boolean;
  getTabAccessibilityLabel?: (tab: TTab) => string;
  keepAlive?: boolean;
  layoutMode?: "content" | "fill";
  lazy?: boolean;
  onChange: (nextTab: TTab) => void;
  onPageProgressChange?: (pageOffset: number) => void;
  onPreviewTabChange?: (nextTab: TTab) => void;
  renderPage: (tab: TTab, preview: boolean, active: boolean) => ReactNode;
  style?: StyleProp<ViewStyle>;
  tabs: readonly TTab[];
};

function clampPageIndex(index: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(Math.max(index, 0), total - 1);
}

type SharedPagerProps<TTab extends string> = Omit<SwipeableTabPagerProps<TTab>, "layoutMode"> & {
  activeIndex: number;
  pageWidth: number;
};

function SwipeableFillPager<TTab extends string>({
  activeIndex,
  activeTab,
  enabled = true,
  getTabAccessibilityLabel,
  keepAlive = true,
  lazy = false,
  onChange,
  onPageProgressChange,
  onPreviewTabChange,
  pageWidth,
  renderPage,
  style,
  tabs,
}: SharedPagerProps<TTab>) {
  const reducedMotion = useReducedMotion();
  const pagerRef = useRef<FlatList<TTab> | null>(null);
  const didMountRef = useRef(false);
  const lastPageWidthRef = useRef(pageWidth);
  const { begin, end, programmaticScrollRef } = useProgrammaticScrollGuard();
  const {
    currentPageRef,
    emitPageProgress,
    emitPreviewIndex,
    renderWindowIndex,
    settleTabIndex,
    syncActiveIndex,
  } = usePagerController({
    activeIndex,
    activeTab,
    getTabAccessibilityLabel,
    onChange,
    onPageProgressChange,
    onPreviewTabChange,
    tabs,
  });

  useEffect(() => {
    const widthChanged = lastPageWidthRef.current !== pageWidth;
    if (currentPageRef.current === activeIndex && !widthChanged) {
      emitPageProgress(activeIndex);
      return;
    }

    lastPageWidthRef.current = pageWidth;
    syncActiveIndex();
    begin();
    const handle = requestAnimationFrame(() => {
      pagerRef.current?.scrollToIndex({
        animated: didMountRef.current && !widthChanged && !reducedMotion,
        index: activeIndex,
      });
      didMountRef.current = true;
    });
    return () => cancelAnimationFrame(handle);
  }, [
    activeIndex,
    begin,
    currentPageRef,
    emitPageProgress,
    pageWidth,
    reducedMotion,
    syncActiveIndex,
  ]);

  const handleScrollPageSettled = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const settledIndex = clampPageIndex(
        Math.round(event.nativeEvent.contentOffset.x / pageWidth),
        tabs.length,
      );

      if (programmaticScrollRef.current) {
        currentPageRef.current = settledIndex;
        emitPageProgress(settledIndex);
        end();
        return;
      }

      settleTabIndex(settledIndex, true);
    },
    [
      currentPageRef,
      emitPageProgress,
      end,
      pageWidth,
      programmaticScrollRef,
      settleTabIndex,
      tabs.length,
    ],
  );
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (programmaticScrollRef.current) return;
      const pageOffset = event.nativeEvent.contentOffset.x / pageWidth;
      emitPageProgress(pageOffset);
      emitPreviewIndex(resolvePagedScrollIndex(pageOffset, currentPageRef.current, tabs.length));
    },
    [
      currentPageRef,
      emitPageProgress,
      emitPreviewIndex,
      pageWidth,
      programmaticScrollRef,
      tabs.length,
    ],
  );

  return (
    <FlatList
      ref={pagerRef}
      data={[...tabs]}
      decelerationRate="fast"
      directionalLockEnabled
      disableIntervalMomentum
      extraData={`${activeIndex}:${pageWidth}`}
      getItemLayout={(_, index) => ({ index, length: pageWidth, offset: pageWidth * index })}
      horizontal
      initialScrollIndex={activeIndex}
      keyExtractor={(tab) => tab}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      onMomentumScrollEnd={handleScrollPageSettled}
      onScroll={handleScroll}
      onScrollBeginDrag={end}
      onScrollToIndexFailed={({ index }) => {
        pagerRef.current?.scrollToOffset({ animated: false, offset: pageWidth * index });
      }}
      overScrollMode="never"
      pagingEnabled
      removeClippedSubviews={false}
      renderItem={({ item: tab, index }) => {
        const active = index === activeIndex;
        const shouldRender = shouldRenderPagedItem(index, renderWindowIndex, keepAlive, lazy);

        return (
          <View collapsable={false} style={[styles.page, { width: pageWidth }]}>
            {shouldRender ? renderPage(tab, !active, active) : null}
          </View>
        );
      }}
      scrollEnabled={enabled && tabs.length > 1}
      scrollEventThrottle={16}
      showsHorizontalScrollIndicator={false}
      style={[styles.pager, style]}
      windowSize={keepAlive ? Math.max(3, tabs.length) : 3}
    />
  );
}

function SwipeableContentPager<TTab extends string>(props: SharedPagerProps<TTab>) {
  const NativePagerView = useMemo(() => loadNativePagerView(), []);
  const nativePagerRef = useRef<NativePagerViewHandle | null>(null);
  const flatPagerRef = useRef<FlatList<TTab> | null>(null);
  const didMountRef = useRef(false);
  const [height, setHeight] = useState<number | null>(null);
  const pageHeightsRef = useRef(new Map<number, number>());
  const reducedMotion = useReducedMotion();
  const { begin, end, programmaticScrollRef } = useProgrammaticScrollGuard();
  const {
    activeIndex,
    currentPageRef,
    emitPageProgress,
    emitPreviewIndex,
    enabled = true,
    keepAlive = true,
    lazy = false,
    pageWidth,
    renderPage,
    renderWindowIndex,
    settleTabIndex,
    style,
    syncActiveIndex,
    tabs,
  } = {
    ...props,
    ...usePagerController(props),
  };
  const updateHeight = useCallback(
    (index: number, nextHeight: number) => {
      if (nextHeight <= 0) return;
      pageHeightsRef.current.set(index, nextHeight);
      if (index !== activeIndex) return;
      setHeight((current) =>
        current && Math.abs(current - nextHeight) < 1 ? current : nextHeight,
      );
    },
    [activeIndex],
  );

  useEffect(() => {
    const measuredHeight = pageHeightsRef.current.get(activeIndex);
    if (measuredHeight) setHeight(measuredHeight);
  }, [activeIndex]);

  useEffect(() => {
    syncActiveIndex();
    begin();
    const handle = requestAnimationFrame(() => {
      if (NativePagerView) {
        if (didMountRef.current) {
          if (reducedMotion) {
            nativePagerRef.current?.setPageWithoutAnimation(activeIndex);
          } else {
            nativePagerRef.current?.setPage(activeIndex);
          }
        } else {
          nativePagerRef.current?.setPageWithoutAnimation(activeIndex);
        }
      } else {
        flatPagerRef.current?.scrollToIndex({
          animated: didMountRef.current && !reducedMotion,
          index: activeIndex,
        });
      }
      didMountRef.current = true;
    });
    return () => cancelAnimationFrame(handle);
  }, [NativePagerView, activeIndex, begin, reducedMotion, syncActiveIndex]);

  const handleSelected = useCallback(
    (event: NativePagerViewOnPageSelectedEvent) => {
      const settledIndex = clampPageIndex(event.nativeEvent.position, tabs.length);
      if (programmaticScrollRef.current) {
        currentPageRef.current = settledIndex;
        emitPageProgress(settledIndex);
        end();
        return;
      }
      settleTabIndex(settledIndex, true);
    },
    [currentPageRef, emitPageProgress, end, programmaticScrollRef, settleTabIndex, tabs.length],
  );
  const handleScroll = useCallback(
    (event: NativePagerViewOnPageScrollEvent) => {
      if (programmaticScrollRef.current) return;
      const pageOffset = event.nativeEvent.position + event.nativeEvent.offset;
      emitPageProgress(pageOffset);
      emitPreviewIndex(resolvePagedScrollIndex(pageOffset, currentPageRef.current, tabs.length));
    },
    [currentPageRef, emitPageProgress, emitPreviewIndex, programmaticScrollRef, tabs.length],
  );
  const handleStateChange = useCallback(
    (event: NativePagerViewOnPageScrollStateChangedEvent) => {
      if (event.nativeEvent.pageScrollState === "dragging") end();
    },
    [end],
  );

  if (!NativePagerView) {
    return (
      <FlatList
        ref={flatPagerRef}
        data={[...tabs]}
        decelerationRate="fast"
        directionalLockEnabled
        disableIntervalMomentum
        extraData={`${activeIndex}:${pageWidth}:${height ?? 0}`}
        getItemLayout={(_, index) => ({ index, length: pageWidth, offset: pageWidth * index })}
        horizontal
        initialScrollIndex={activeIndex}
        keyExtractor={(tab) => tab}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        onMomentumScrollEnd={(event) => {
          const settledIndex = clampPageIndex(
            Math.round(event.nativeEvent.contentOffset.x / pageWidth),
            tabs.length,
          );
          if (programmaticScrollRef.current) {
            currentPageRef.current = settledIndex;
            emitPageProgress(settledIndex);
            end();
            return;
          }
          settleTabIndex(settledIndex, true);
        }}
        onScroll={(event) => {
          if (programmaticScrollRef.current) return;
          const pageOffset = event.nativeEvent.contentOffset.x / pageWidth;
          emitPageProgress(pageOffset);
          emitPreviewIndex(
            resolvePagedScrollIndex(pageOffset, currentPageRef.current, tabs.length),
          );
        }}
        onScrollBeginDrag={end}
        onScrollToIndexFailed={({ index }) => {
          flatPagerRef.current?.scrollToOffset({ animated: false, offset: pageWidth * index });
        }}
        overScrollMode="never"
        pagingEnabled
        removeClippedSubviews={false}
        renderItem={({ item: tab, index }) => {
          const active = index === activeIndex;
          const shouldRender = shouldRenderPagedItem(index, renderWindowIndex, keepAlive, lazy);

          return (
            <View collapsable={false} style={[styles.contentPage, { width: pageWidth }]}>
              <View
                collapsable={false}
                onLayout={(event) => updateHeight(index, event.nativeEvent.layout.height)}
              >
                {shouldRender ? renderPage(tab, !active, active) : null}
              </View>
            </View>
          );
        }}
        scrollEnabled={enabled && tabs.length > 1}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        style={[styles.contentPager, height ? { height } : null, style]}
        windowSize={keepAlive ? Math.max(3, tabs.length) : 3}
      />
    );
  }

  return (
    <NativePagerView
      ref={nativePagerRef}
      initialPage={activeIndex}
      offscreenPageLimit={keepAlive ? Math.max(1, tabs.length - 1) : 1}
      onPageScroll={handleScroll}
      onPageScrollStateChanged={handleStateChange}
      onPageSelected={handleSelected}
      scrollEnabled={enabled && tabs.length > 1}
      style={[styles.contentPager, height ? { height } : null, style]}
    >
      {tabs.map((tab, index) => {
        const active = index === activeIndex;
        const shouldRender = shouldRenderPagedItem(index, renderWindowIndex, keepAlive, lazy);

        return (
          <View collapsable={false} key={tab} style={styles.nativePage}>
            <View
              collapsable={false}
              onLayout={(event) => updateHeight(index, event.nativeEvent.layout.height)}
            >
              {shouldRender ? renderPage(tab, !active, active) : null}
            </View>
          </View>
        );
      })}
    </NativePagerView>
  );
}

export function SwipeableTabPager<TTab extends string>({
  activeTab,
  layoutMode = "fill",
  tabs,
  ...props
}: SwipeableTabPagerProps<TTab>) {
  const { width } = useWindowDimensions();
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab === activeTab),
  );
  const sharedProps = {
    ...props,
    activeIndex,
    activeTab,
    pageWidth: Math.max(1, width),
    tabs,
  } satisfies SharedPagerProps<TTab>;

  if (layoutMode === "content") {
    return <SwipeableContentPager {...sharedProps} />;
  }

  return <SwipeableFillPager {...sharedProps} />;
}

const styles = StyleSheet.create({
  contentPager: {
    width: "100%",
  },
  contentPage: {
    width: "100%",
  },
  nativePage: {
    flex: 1,
  },
  page: {
    flex: 1,
    height: "100%",
  },
  pager: {
    flex: 1,
  },
});
