import React from "react";
import { act, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

let latestListProps: Record<string, unknown> | null = null;

jest.mock("../../../shared/components", () => {
  const React = require("react");
  const { Text, View } = require("react-native");

  return {
    AppFlatList: React.forwardRef(function MockAppFlatList(props: unknown, _ref: unknown) {
      latestListProps = props as Record<string, unknown>;
      const { data = [], renderItem } = props as {
        data?: Array<{ id: string }>;
        renderItem?: (params: { index: number; item: { id: string } }) => React.ReactNode;
      };
      return (
        <View testID="home-feed-list">
          {data.map((item, index) => (
            <React.Fragment key={item.id}>{renderItem?.({ index, item })}</React.Fragment>
          ))}
        </View>
      );
    }),
    AppListSkeleton: () => <Text>Skeleton</Text>,
  };
});

import { HomeFeedList } from "./HomeFeedList";

type Item = { id: string; kind: string };

function createProps(overrides: Record<string, unknown> = {}) {
  return {
    bottomPadding: 24,
    data: [{ id: "one", kind: "album" }] as Item[],
    errorMessage: null,
    hasMore: true,
    listRef: React.createRef<any>(),
    loadState: { isBlocking: false },
    loadingMore: false,
    onEndReached: jest.fn(),
    onRefresh: jest.fn().mockResolvedValue(undefined),
    onUserInteraction: jest.fn(),
    onViewableItemsChanged: jest.fn(),
    refreshing: false,
    renderFeedItem: (item: Item, index: number) => <Text>{`${item.id}:${index}`}</Text>,
    viewabilityConfig: { itemVisiblePercentThreshold: 50 },
    ...overrides,
  };
}

describe("HomeFeedList", () => {
  beforeEach(() => {
    latestListProps = null;
  });

  it("uses typed FlashList recycling and delegates user actions", async () => {
    const onEndReached = jest.fn();
    const onRefresh = jest.fn().mockResolvedValue(undefined);
    const onUserInteraction = jest.fn();
    const props = createProps({ onEndReached, onRefresh, onUserInteraction });
    render(<HomeFeedList {...props} />);

    expect(screen.getByTestId("home-feed-list")).toBeOnTheScreen();
    const listProps = latestListProps as {
      getItemType: (item: Item) => string;
      keyExtractor: (item: Item) => string;
      onEndReached: () => void;
      onRefresh: () => void;
      onScrollBeginDrag: () => void;
      onTouchStart: () => void;
    };
    expect(listProps.keyExtractor(props.data[0])).toBe("album-one");
    expect(listProps.getItemType(props.data[0])).toBe("album");

    act(() => listProps.onScrollBeginDrag());
    act(() => listProps.onTouchStart());
    await act(async () => listProps.onRefresh());
    act(() => listProps.onEndReached());

    expect(onUserInteraction).toHaveBeenCalledTimes(2);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onEndReached).toHaveBeenCalledTimes(1);
  });

  it("keeps existing content visible while refreshes fail or block", () => {
    const props = createProps({ errorMessage: "failed", loadState: { isBlocking: true } });
    render(<HomeFeedList {...props} />);

    expect(latestListProps).toMatchObject({
      error: null,
      loading: false,
    });
  });

  it("records the first recycled-list draw", () => {
    const onFirstDraw = jest.fn();
    render(<HomeFeedList {...createProps({ onFirstDraw })} />);

    act(() => {
      (latestListProps as { onLoad?: (info: { elapsedTimeInMs: number }) => void }).onLoad?.({
        elapsedTimeInMs: 42,
      });
    });

    expect(onFirstDraw).toHaveBeenCalledWith(42);
  });
});
