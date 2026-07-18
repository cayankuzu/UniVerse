import React from "react";
import { render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { appTheme } from "../../../../shared/theme";
import { ProfileScreen } from "./ProfileScreen";
import { useOwnProfileScreenState } from "../../application/useOwnProfileScreenState";

jest.mock("../../application/useOwnProfileScreenState", () => ({
  useOwnProfileScreenState: jest.fn(),
}));

jest.mock("../../../../app-shell/auth", () => ({
  useAuth: () => ({
    accountType: "student",
    authBootState: "signed_in_hydrated",
    blockedUsers: [],
    userData: { id: "viewer-1", username: "viewer" },
  }),
}));

jest.mock("../../../../app-shell/navigation/TabReselectContext", () => ({
  useTabReselectCounter: () => 0,
}));

jest.mock("../../../../app-shell/onboarding", () => ({
  TourAnchor: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

jest.mock("../../../../app-shell/navigation/hooks/useIntentNavigation", () => ({
  useOpenAlbumView: () => () => undefined,
  useOpenEventDetail: () => () => undefined,
  useOpenProfile: () => () => undefined,
}));

jest.mock("../../../../shared/components", () => {
  const React = require("react");
  const { View } = require("react-native");
  const actual = jest.requireActual("../../../../shared/components");
  const AppFlatList = React.forwardRef(
    (
      {
        data = [],
        keyExtractor,
        ListHeaderComponent,
        renderItem,
        ListFooterComponent,
      }: {
        data?: unknown[];
        keyExtractor?: (item: unknown, index: number) => string;
        ListHeaderComponent?: React.ReactNode;
        renderItem?: (params: { index: number; item: unknown }) => React.ReactNode;
        ListFooterComponent?: React.ReactNode;
      },
      _ref: React.ForwardedRef<unknown>,
    ) =>
      React.createElement(
        View,
        null,
        ListHeaderComponent ?? null,
        data.map((item, index) =>
          React.createElement(
            View,
            { key: keyExtractor?.(item, index) ?? String(index) },
            renderItem?.({ item, index }) ?? null,
          ),
        ),
        ListFooterComponent ?? null,
      ),
  );
  AppFlatList.displayName = "MockAppFlatList";

  return {
    ...actual,
    AppFlatList,
  };
});

const mockedUseOwnProfileScreenState = useOwnProfileScreenState as jest.MockedFunction<
  typeof useOwnProfileScreenState
>;

function renderWithProviders(node: React.ReactElement) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 44, right: 0, bottom: 34, left: 0 },
      }}
    >
      <PaperProvider theme={appTheme}>{node}</PaperProvider>
    </SafeAreaProvider>,
  );
}

function createOwnProfileState(overrides: Record<string, unknown> = {}) {
  return {
    albumOwnerFilter: "all",
    albumOwnerFilterExpanded: false,
    albumRelationByClub: {},
    albums: [],
    bottomPadding: 24,
    displayName: "Cyn User",
    emptyText: "İçerik yok",
    errorMessage: null,
    eventRelationByClub: {},
    events: [],
    grid: {
      cardHeight: 196,
      cardWidth: 168,
      horizontalPadding: 10,
      mediaHeight: 118,
      rowGap: 8,
    },
    handleOpenAlbumView: () => undefined,
    handleOpenEventDetail: () => undefined,
    handleOpenFollowers: () => undefined,
    handleOpenFollowing: () => undefined,
    handleOpenProfile: () => undefined,
    handleOpenSettings: () => undefined,
    handleSetTab: () => undefined,
    isLoading: false,
    listRef: { current: null },
    loadMore: async () => undefined,
    loadingMore: false,
    numColumns: 2,
    onRefresh: async () => undefined,
    prefetchEventById: async () => undefined,
    prefetchProfileByUsername: async () => undefined,
    profileUsername: "viewer",
    refreshing: false,
    resolvedAccountType: "student",
    resolvedUserData: {
      categories: ["Music"],
      followers: 12,
      following: 5,
      id: "viewer-1",
      name: "Cyn User",
      username: "viewer",
      university: "Uni",
    },
    setAlbumOwnerFilter: () => undefined,
    setAlbumOwnerFilterExpanded: () => undefined,
    tab: "album",
    tabs: [
      { key: "album", label: "Albümler", count: 1 },
      { key: "events", label: "Etkinlikler", count: 0 },
    ],
    tileData: [
      {
        eventId: "event-1",
        id: "album-1",
        image: "https://example.com/album.jpg",
        imageVariants: {
          medium: "https://example.com/album-medium.jpg",
          thumbnail: "https://example.com/album-thumb.jpg",
        },
        name: "Cyn User",
        photoCount: 1,
        title: "Album",
        username: "viewer",
      },
    ],
    viewportPrefetch: {
      onViewableItemsChanged: () => undefined,
      viewabilityConfig: {},
    },
    ...overrides,
  } as any;
}

describe("ProfileScreen smoke", () => {
  beforeEach(() => {
    mockedUseOwnProfileScreenState.mockReturnValue(createOwnProfileState());
  });

  it("renders the own profile screen without crashing", () => {
    const screen = renderWithProviders(
      <ProfileScreen
        navigation={
          {
            navigate: () => undefined,
          } as any
        }
        route={{ key: "Profile", name: "Profile" } as any}
      />,
    );

    expect(screen.getByText("Cyn User")).toBeTruthy();
    expect(screen.getByText("@viewer")).toBeTruthy();
  });
});
