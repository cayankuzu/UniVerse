import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ProfileStaticGrid } from "./ProfileStaticGrid";

jest.mock("../../../../shared/components", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    AppListSkeleton: ({ itemHeight }: { itemHeight: number }) =>
      React.createElement(Text, { testID: "grid-skeleton" }, `skeleton:${itemHeight}`),
    AsyncState: ({ error }: { error: string }) =>
      React.createElement(Text, { testID: "grid-error" }, error),
    EmptyState: ({ title }: { title: string }) =>
      React.createElement(Text, { testID: "grid-empty" }, title),
    LoadingSpinner: () => React.createElement(Text, { testID: "grid-spinner" }, "spinner"),
  };
});

jest.mock("../../../../shared/i18n", () => ({
  t: (key: string) => key,
}));

jest.mock("./ProfileTileCard", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  return {
    ProfileTileCard: ({ item, onOpenAlbum, onOpenEvent }: any) =>
      React.createElement(
        View,
        { testID: `tile-${item.id}` },
        React.createElement(Text, { onPress: onOpenAlbum, testID: `album-${item.id}` }, "album"),
        React.createElement(Text, { onPress: onOpenEvent, testID: `event-${item.id}` }, "event"),
      ),
  };
});

function createProps(overrides: Record<string, unknown> = {}) {
  return {
    data: [],
    emptyText: "No content",
    error: false,
    gridHorizontalPadding: 12,
    gridRowGap: 8,
    loading: false,
    numColumns: 2,
    onOpenAlbumAt: jest.fn(),
    onOpenEventAt: jest.fn(),
    onOpenProfile: jest.fn(),
    profileAccountType: "student" as const,
    profileOwnerId: "owner-1",
    profileOwnerUsername: "owner",
    tab: "album" as const,
    ...overrides,
  };
}

describe("ProfileStaticGrid", () => {
  it("renders loading, error and empty states for either profile tab", () => {
    const loading = render(
      <ProfileStaticGrid {...createProps({ loading: true, numColumns: 3 })} />,
    );
    expect(loading.getByText("skeleton:156")).toBeTruthy();
    loading.unmount();

    const error = render(
      <ProfileStaticGrid {...createProps({ error: true, tab: "events" as const })} />,
    );
    expect(error.getByText("profile.error.events")).toBeTruthy();
    error.unmount();

    const empty = render(<ProfileStaticGrid {...createProps()} />);
    expect(empty.getByText("No content")).toBeTruthy();
  });

  it("lays out columns, reports height and forwards card actions", () => {
    const onContentHeightChange = jest.fn();
    const onOpenAlbumAt = jest.fn();
    const onOpenEventAt = jest.fn();
    const data = [
      { id: "one", title: "One" },
      { id: "two", title: "Two" },
      { id: "three", title: "Three" },
    ] as any;
    const screen = render(
      <ProfileStaticGrid
        {...createProps({
          cardHeight: 210,
          data,
          loadingMore: true,
          onContentHeightChange,
          onOpenAlbumAt,
          onOpenEventAt,
          showEndText: true,
          tourTargetIndex: 1,
        })}
      />,
    );

    fireEvent(screen.getByTestId("profile-static-grid-album"), "layout", {
      nativeEvent: { layout: { height: 321.2 } },
    });
    fireEvent.press(screen.getByTestId("album-two"));
    fireEvent.press(screen.getByTestId("event-three"));

    expect(onContentHeightChange).toHaveBeenCalledWith(322);
    expect(onOpenAlbumAt).toHaveBeenCalledWith(data[1], 1);
    expect(onOpenEventAt).toHaveBeenCalledWith(data[2], 2);
    expect(screen.getByTestId("grid-spinner")).toBeTruthy();
    expect(screen.getByText("common.loading")).toBeTruthy();
    expect(screen.getByText("common.list.end")).toBeTruthy();
  });
});
