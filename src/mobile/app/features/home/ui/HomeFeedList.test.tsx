import React from "react";
import { act, render } from "@testing-library/react-native";
import { FlatList, Text } from "react-native";
import { HomeFeedList } from "./HomeFeedList";

type Item = { id: string; kind: string };

function createProps(overrides: Record<string, unknown> = {}) {
  return {
    bottomPadding: 24,
    data: [{ id: "one", kind: "album" }] as Item[],
    errorMessage: null,
    hasMore: true,
    listRef: React.createRef<FlatList<Item>>(),
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
  it("renders feed items, refreshes and loads the next page only once per data length", () => {
    const onEndReached = jest.fn();
    const onRefresh = jest.fn().mockResolvedValue(undefined);
    const onUserInteraction = jest.fn();
    const props = createProps({ onEndReached, onRefresh, onUserInteraction });
    const screen = render(<HomeFeedList {...props} />);
    let list = screen.UNSAFE_getByType(FlatList);

    expect(screen.getByText("one:0")).toBeTruthy();
    expect(list.props.keyExtractor(props.data[0])).toBe("album-one");
    act(() => list.props.onScrollBeginDrag());
    act(() => list.props.onTouchStart());
    act(() => list.props.onRefresh());
    act(() => list.props.onEndReached());
    act(() => list.props.onEndReached());

    expect(onUserInteraction).toHaveBeenCalledTimes(2);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onEndReached).toHaveBeenCalledTimes(1);

    const nextData = [...props.data, { id: "two", kind: "event" }];
    screen.rerender(<HomeFeedList {...props} data={nextData} />);
    list = screen.UNSAFE_getByType(FlatList);
    act(() => list.props.onEndReached());
    expect(onEndReached).toHaveBeenCalledTimes(2);
  });

  it("blocks pagination for every non-actionable list state", () => {
    const onEndReached = jest.fn();
    const cases = [
      { data: [] },
      { loadState: { isBlocking: true } },
      { loadingMore: true },
      { refreshing: true },
      { hasMore: false },
    ];

    for (const override of cases) {
      const screen = render(<HomeFeedList {...createProps({ ...override, onEndReached })} />);
      const list = screen.UNSAFE_getByType(FlatList);
      act(() => list.props.onEndReached());
      screen.unmount();
    }

    expect(onEndReached).not.toHaveBeenCalled();
  });

  it("renders loading, terminal, empty and error surfaces", () => {
    const loadingMore = render(<HomeFeedList {...createProps({ loadingMore: true })} />);
    expect(loadingMore.UNSAFE_getByType(FlatList).props.ListFooterComponent).toBeTruthy();
    loadingMore.unmount();

    const terminal = render(<HomeFeedList {...createProps({ hasMore: false })} />);
    expect(terminal.UNSAFE_getByType(FlatList).props.ListFooterComponent).toBeTruthy();
    terminal.unmount();

    const empty = render(<HomeFeedList {...createProps({ data: [] })} />);
    expect(empty.UNSAFE_getByType(FlatList).props.ListEmptyComponent).toBeTruthy();
    empty.unmount();

    const error = render(<HomeFeedList {...createProps({ data: [], errorMessage: "failed" })} />);
    expect(error.UNSAFE_getByType(FlatList).props.ListEmptyComponent).toBeTruthy();
  });
});
