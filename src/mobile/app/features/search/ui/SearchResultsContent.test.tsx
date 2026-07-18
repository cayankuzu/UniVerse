import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

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
    AppFlatList: ReactRuntime.forwardRef((props: Record<string, any>, _ref) =>
      ReactRuntime.createElement(
        View,
        null,
        props.data.map((item: unknown, index: number) =>
          ReactRuntime.createElement(
            ReactRuntime.Fragment,
            { key: String((item as { id?: string }).id || index) },
            props.renderItem({ index, item }),
          ),
        ),
      ),
    ),
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
  it("routes card intent immediately and switches paged result types", () => {
    const onOpenAlbumCard = jest.fn();
    const onOpenEventCard = jest.fn();
    const onOpenProfile = jest.fn();
    const onSelectType = jest.fn();
    const prefetchEventById = jest.fn();
    const prefetchProfileByUsername = jest.fn();
    const screen = render(
      <SearchResultsContent
        bottomPadding={0}
        currentError={null}
        currentLoading={false}
        emptyText="empty"
        filteredAlbums={[{ id: "album-1" } as never]}
        filteredClubs={[{ id: "club-1" } as never]}
        filteredEvents={[{ id: "event-1" } as never]}
        filteredStudents={[]}
        grid={{
          cardHeight: 200,
          cardWidth: 160,
          horizontalPadding: 12,
          mediaHeight: 120,
          rowGap: 8,
        }}
        listRef={{ current: null }}
        loadingMore={false}
        numColumns={2}
        onEndReached={jest.fn()}
        onOpenAlbumCard={onOpenAlbumCard}
        onOpenEventCard={onOpenEventCard}
        onOpenProfile={onOpenProfile}
        onRefresh={jest.fn()}
        onSelectType={onSelectType}
        prefetchEventById={prefetchEventById}
        prefetchProfileByUsername={prefetchProfileByUsername}
        refreshing={false}
        type="albums"
        viewportPrefetch={{}}
      />,
    );

    fireEvent.press(screen.getByTestId("album-prefetch"));
    fireEvent.press(screen.getByTestId("album-open"));
    fireEvent.press(screen.getByTestId("event-prefetch"));
    fireEvent.press(screen.getByTestId("event-open"));
    fireEvent.press(screen.getByTestId("profile-prefetch"));
    fireEvent.press(screen.getByTestId("profile-open"));
    fireEvent(screen.getByTestId("search-pager"), "momentumScrollEnd", {
      nativeEvent: { contentOffset: { x: 100_000 } },
    });

    expect(prefetchEventById).toHaveBeenCalledWith("event-from-album");
    expect(prefetchEventById).toHaveBeenCalledWith("event-1");
    expect(prefetchProfileByUsername).toHaveBeenCalledWith("alice");
    expect(onOpenAlbumCard).toHaveBeenCalled();
    expect(onOpenEventCard).toHaveBeenCalled();
    expect(onOpenProfile).toHaveBeenCalled();
    expect(onSelectType).toHaveBeenCalledWith("students");
  });
});
