import React from "react";
import { render, screen } from "@testing-library/react-native";

jest.mock("@shopify/flash-list", () => {
  const React = require("react");

  return {
    FlashList: React.forwardRef(function MockFlashList(props: unknown, _ref: unknown) {
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
        <>
          {ListHeaderComponent ?? null}
          {data.length === 0
            ? (ListEmptyComponent ?? null)
            : data.map((item: unknown, index: number) => renderItem?.({ item, index }) ?? null)}
          {ListFooterComponent ?? null}
        </>
      );
    }),
  };
});

import { AlbumViewPhotoGrid } from "./AlbumViewPhotoGrid";

const grid = {
  cardHeight: 180,
  cardWidth: 160,
  horizontalPadding: 0,
  mediaHeight: 120,
  rowGap: 8,
};

describe("AlbumViewPhotoGrid", () => {
  it("shows a skeleton instead of empty copy on initial loading", () => {
    render(
      <AlbumViewPhotoGrid
        error={null}
        grid={grid}
        loading
        loadingMore={false}
        onLoadMore={() => undefined}
        onOpenPhoto={() => undefined}
        onRefresh={() => undefined}
        photos={[]}
        refreshing={false}
      />,
    );

    expect(screen.queryByText("Albüm boş")).not.toBeOnTheScreen();
    expect(screen.queryByText("Yükleniyor...")).not.toBeOnTheScreen();
  });

  it("renders the shared error state when the grid has no data", () => {
    render(
      <AlbumViewPhotoGrid
        error="Albüm verisi yüklenemedi"
        grid={grid}
        loading={false}
        loadingMore={false}
        onLoadMore={() => undefined}
        onOpenPhoto={() => undefined}
        onRefresh={() => undefined}
        photos={[]}
        refreshing={false}
      />,
    );

    expect(screen.getByText("Albüm verisi yüklenemedi")).toBeOnTheScreen();
  });
});
