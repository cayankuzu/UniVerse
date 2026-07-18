import React from "react";
import { Text } from "react-native";
import { act, render, screen } from "@testing-library/react-native";

let latestFlashListProps: Record<string, unknown> | null = null;

jest.mock("@shopify/flash-list", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    FlashList: React.forwardRef(function MockFlashList(props: unknown, _ref: unknown) {
      latestFlashListProps = props as Record<string, unknown>;
      const {
        data = [],
        ListEmptyComponent,
        ListFooterComponent,
        ListHeaderComponent,
        renderItem,
      } = props as {
        data?: unknown[];
        ListEmptyComponent?: React.ReactNode;
        ListFooterComponent?: React.ReactNode;
        ListHeaderComponent?: React.ReactNode;
        renderItem?: (params: { index: number; item: unknown }) => React.ReactNode;
      };

      return (
        <View testID="flash-list">
          {ListHeaderComponent ?? null}
          {data.length === 0
            ? (ListEmptyComponent ?? null)
            : data.map((item: unknown, index: number) => (
                <React.Fragment key={String((item as { id?: string } | null)?.id || index)}>
                  {renderItem?.({ item, index }) ?? null}
                </React.Fragment>
              ))}
          {ListFooterComponent ?? null}
        </View>
      );
    }),
  };
});

import { AppFlatList } from "./AppFlatList";
import {
  degradeRuntimePerformanceTier,
  resetRuntimePerformanceTierForTests,
} from "../performance/runtimePerformanceTier";

describe("AppFlatList", () => {
  beforeEach(() => {
    latestFlashListProps = null;
    resetRuntimePerformanceTierForTests();
  });

  afterEach(() => {
    act(() => {
      resetRuntimePerformanceTierForTests();
    });
  });

  it("prefers a loading skeleton over the empty state while loading", () => {
    render(
      <AppFlatList
        data={[]}
        emptyText="No items"
        keyExtractor={(item: { id: string }) => item.id}
        loading
        renderItem={() => <Text>Row</Text>}
      />,
    );

    expect(screen.queryByText("No items")).not.toBeOnTheScreen();
    expect(screen.queryByText("Yükleniyor...")).not.toBeOnTheScreen();
  });

  it("renders the shared empty title and subtitle when empty", () => {
    render(
      <AppFlatList
        data={[]}
        emptySubtitle="Try changing the filter."
        emptyTitle="No items"
        keyExtractor={(item: { id: string }) => item.id}
        renderItem={() => <Text>Row</Text>}
      />,
    );

    expect(screen.getByText("No items")).toBeOnTheScreen();
    expect(screen.getByText("Try changing the filter.")).toBeOnTheScreen();
  });

  it("renders the shared error state when empty and errored", () => {
    render(
      <AppFlatList
        data={[]}
        error="Load failed"
        keyExtractor={(item: { id: string }) => item.id}
        renderItem={() => <Text>Row</Text>}
      />,
    );

    expect(screen.getByText("Load failed")).toBeOnTheScreen();
  });

  it("gates native load-more signals to once per data length", () => {
    const onEndReached = jest.fn();

    const rendered = render(
      <AppFlatList
        data={Array.from({ length: 33 }, (_, index) => ({ id: String(index) }))}
        estimatedItemSize={200}
        hasMore
        keyExtractor={(item: { id: string }) => item.id}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.82}
        renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
      />,
    );

    const flashListProps = latestFlashListProps as {
      onEndReached?: () => void;
    };

    act(() => {
      flashListProps.onEndReached?.();
      flashListProps.onEndReached?.();
    });

    expect(onEndReached).toHaveBeenCalledTimes(1);

    rendered.rerender(
      <AppFlatList
        data={Array.from({ length: 34 }, (_, index) => ({ id: String(index) }))}
        estimatedItemSize={200}
        hasMore
        keyExtractor={(item: { id: string }) => item.id}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.82}
        renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
      />,
    );

    act(() => {
      (latestFlashListProps as { onEndReached?: () => void }).onEndReached?.();
    });

    expect(onEndReached).toHaveBeenCalledTimes(2);
  });

  it("maps the item estimate to FlashList v2 draw distance", () => {
    render(
      <AppFlatList
        data={[{ id: "1" }]}
        estimatedItemSize={200}
        keyExtractor={(item: { id: string }) => item.id}
        renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
      />,
    );

    expect(latestFlashListProps).not.toHaveProperty("estimatedItemSize");
    expect(latestFlashListProps?.drawDistance).toBe(1_200);
  });

  it("reduces offscreen rendering after a runtime memory-pressure signal", () => {
    degradeRuntimePerformanceTier("tier3");
    render(
      <AppFlatList
        data={[{ id: "1" }]}
        estimatedItemSize={200}
        keyExtractor={(item: { id: string }) => item.id}
        performanceTier="tier1"
        renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
      />,
    );

    expect(latestFlashListProps?.drawDistance).toBe(800);
  });

  it("renders a shared end-of-list footer when pagination is finished", () => {
    render(
      <AppFlatList
        data={[{ id: "1" }]}
        endReachedText="No more items"
        hasMore={false}
        keyExtractor={(item: { id: string }) => item.id}
        renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
      />,
    );

    expect(screen.getByText("No more items")).toBeOnTheScreen();
  });

  it("does not show an indeterminate footer spinner when hasMore is unknown", () => {
    render(
      <AppFlatList
        data={[{ id: "1" }]}
        keyExtractor={(item: { id: string }) => item.id}
        renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
      />,
    );

    expect(latestFlashListProps?.ListFooterComponent).toBeNull();
  });
});
