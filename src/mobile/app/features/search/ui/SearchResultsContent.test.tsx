import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";

jest.mock("react-native", () => {
  const ReactRuntime = require("react") as typeof React;
  const NativeRuntime = jest.requireActual("react-native") as typeof import("react-native");
  const MockFlatList = ReactRuntime.forwardRef(
    (props: Record<string, any>, ref: React.ForwardedRef<unknown>) => {
      ReactRuntime.useImperativeHandle(ref, () => ({
        scrollToIndex: jest.fn(),
        scrollToOffset: jest.fn(),
      }));
      return ReactRuntime.createElement(
        NativeRuntime.ScrollView,
        { onMomentumScrollEnd: props.onMomentumScrollEnd, testID: "search-pager" },
        props.data.map((item: unknown, index: number) =>
          ReactRuntime.createElement(
            ReactRuntime.Fragment,
            { key: String(item) },
            props.renderItem({ index, item }),
          ),
        ),
      );
    },
  );
  return new Proxy(NativeRuntime, {
    get(target, property) {
      return property === "FlatList" ? MockFlatList : Reflect.get(target, property);
    },
  });
});

jest.mock("../../../shared/components", () => {
  const ReactRuntime = require("react") as typeof React;
  const { View } = require("react-native") as typeof import("react-native");
  return {
    AppFlatList: ReactRuntime.forwardRef((props: Record<string, any>, ref) => {
      ReactRuntime.useImperativeHandle(ref, () => ({ scrollToOffset: jest.fn() }));
      return ReactRuntime.createElement(
        View,
        {
          onScroll: props.onScroll,
          onViewableItemsChanged: props.onViewableItemsChanged,
          testID: "search-grid",
        } as any,
        props.data.map((item: unknown, index: number) =>
          ReactRuntime.createElement(
            ReactRuntime.Fragment,
            { key: String((item as { id?: string }).id || index) },
            props.renderItem({ index, item }),
          ),
        ),
      );
    }),
    AppListSkeleton: () => null,
  };
});
jest.mock("../../../app-shell/onboarding", () => ({
  TourAnchor: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("../../content-cards/public/presentation", () => ({
  buildPreparedAlbumVisibility: () => ({}),
}));
jest.mock("../application/searchCardPresentation", () => ({
  resolveSearchEventAccess: () => ({}),
}));
jest.mock("../../../features/content-cards/public/cards", () => {
  const ReactRuntime = require("react") as typeof React;
  const { Pressable, Text, View } = require("react-native") as typeof import("react-native");
  const action = (testID: string, onPress?: () => void) =>
    ReactRuntime.createElement(
      Pressable,
      { onPress, testID },
      ReactRuntime.createElement(Text, null, testID),
    );
  return {
    DiscoveryAlbumGridCard: (props: Record<string, any>) =>
      ReactRuntime.createElement(
        View,
        null,
        action("album-prefetch", () => props.onPrefetchEvent("event-from-album")),
        action("album-open", props.onPress),
      ),
    DiscoveryEventGridCard: (props: Record<string, any>) =>
      ReactRuntime.createElement(
        View,
        null,
        action("event-prefetch", () => props.onPrefetchEvent("event-1")),
        action("event-open", props.onPress),
      ),
    DiscoveryUserGridCard: (props: Record<string, any>) =>
      ReactRuntime.createElement(
        View,
        null,
        action("profile-prefetch", () => props.onPrefetchProfile("alice")),
        action("profile-open", () => props.onPress(props.item)),
      ),
  };
});

import { SearchResultsContent } from "./SearchResultsContent";

describe("SearchResultsContent", () => {
  it("mounts only the selected result type and routes its card intent", () => {
    const onOpenAlbumCard = jest.fn();
    const onOpenEventCard = jest.fn();
    const onOpenProfile = jest.fn();
    const prefetchEventById = jest.fn();
    const prefetchProfileByUsername = jest.fn();
    const sharedProps = {
      bottomPadding: 0,
      currentError: null,
      currentLoading: false,
      emptyText: "empty",
      filteredAlbums: [{ id: "album-1" } as never],
      filteredClubs: [{ id: "club-1" } as never],
      filteredEvents: [{ id: "event-1" } as never],
      filteredStudents: [],
      grid: {
        cardHeight: 200,
        cardWidth: 160,
        horizontalPadding: 12,
        mediaHeight: 120,
        rowGap: 8,
      },
      listRef: { current: null },
      loadingMore: false,
      numColumns: 2,
      onEndReached: jest.fn(),
      onOpenAlbumCard,
      onOpenEventCard,
      onOpenProfile,
      onRefresh: jest.fn(),
      prefetchEventById,
      prefetchProfileByUsername,
      refreshing: false,
      viewportPrefetch: {},
    };
    const screen = render(<SearchResultsContent {...sharedProps} type="albums" />);

    fireEvent.press(screen.getByTestId("album-prefetch"));
    fireEvent.press(screen.getByTestId("album-open"));
    expect(screen.queryByTestId("event-open")).toBeNull();
    expect(screen.queryByTestId("profile-open")).toBeNull();

    screen.rerender(<SearchResultsContent {...sharedProps} type="events" />);
    fireEvent.press(screen.getByTestId("event-prefetch"));
    fireEvent.press(screen.getByTestId("event-open"));
    expect(screen.queryByTestId("album-open")).toBeNull();

    screen.rerender(<SearchResultsContent {...sharedProps} type="clubs" />);
    fireEvent.press(screen.getByTestId("profile-prefetch"));
    fireEvent.press(screen.getByTestId("profile-open"));

    expect(prefetchEventById).toHaveBeenCalledWith("event-from-album");
    expect(prefetchEventById).toHaveBeenCalledWith("event-1");
    expect(prefetchProfileByUsername).toHaveBeenCalledWith("alice");
    expect(onOpenAlbumCard).toHaveBeenCalled();
    expect(onOpenEventCard).toHaveBeenCalled();
    expect(onOpenProfile).toHaveBeenCalled();
  });

  it("registers per-tab list state, reports offsets and suppresses preview side effects", () => {
    const onListRef = jest.fn();
    const onScrollOffsetChange = jest.fn();
    const onViewableItemsChanged = jest.fn();
    const props = {
      bottomPadding: 0,
      currentError: null,
      currentLoading: false,
      emptyText: "empty",
      filteredAlbums: [{ id: "album-1" } as never],
      filteredClubs: [],
      filteredEvents: [],
      filteredStudents: [],
      grid: {
        cardHeight: 200,
        cardWidth: 160,
        horizontalPadding: 12,
        mediaHeight: 120,
        rowGap: 8,
      },
      hasMore: true,
      listRef: { current: null },
      loadingMore: false,
      numColumns: 2,
      onEndReached: jest.fn(),
      onListRef,
      onOpenAlbumCard: jest.fn(),
      onOpenEventCard: jest.fn(),
      onOpenProfile: jest.fn(),
      onRefresh: jest.fn(),
      onScrollOffsetChange,
      prefetchEventById: jest.fn(),
      prefetchProfileByUsername: jest.fn(),
      refreshing: false,
      viewportPrefetch: { onViewableItemsChanged, viewabilityConfig: { minimumViewTime: 50 } },
    };
    const screen = render(<SearchResultsContent {...props} type="albums" />);
    let grid = screen.getByTestId("search-grid");
    const viewabilityInfo = { changed: [], viewableItems: [] };

    fireEvent.scroll(grid, { nativeEvent: { contentOffset: { y: 123 } } });
    act(() => grid.props.onViewableItemsChanged(viewabilityInfo));
    expect(onListRef).toHaveBeenCalledWith("albums", expect.any(Object));
    expect(props.listRef.current).toEqual(expect.any(Object));
    expect(onScrollOffsetChange).toHaveBeenCalledWith("albums", 123);
    expect(onViewableItemsChanged).toHaveBeenCalledWith(viewabilityInfo);

    screen.rerender(<SearchResultsContent {...props} preview type="students" />);
    grid = screen.getByTestId("search-grid");
    act(() => grid.props.onViewableItemsChanged(viewabilityInfo));
    expect(grid.props.onScroll).toBeUndefined();
    expect(onViewableItemsChanged).toHaveBeenCalledTimes(1);
    expect(onListRef).toHaveBeenLastCalledWith("students", expect.any(Object));
  });
});
