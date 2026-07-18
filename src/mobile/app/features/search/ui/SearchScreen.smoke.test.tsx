import React, { createRef } from "react";
import { render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { appTheme } from "../../../shared/theme";
import { SearchScreen } from "./SearchScreen";
import { useSearchResults } from "../application/useSearchResults";

jest.mock("../application/useSearchResults", () => ({
  useSearchResults: jest.fn(),
}));

jest.mock("./SearchTopPanel", () => ({
  SearchTopPanel: () => null,
}));

jest.mock("./SearchFeedViewers", () => ({
  SearchFeedViewers: () => null,
}));

jest.mock("../../../app-shell/auth", () => ({
  useAuth: () => ({
    accountType: "student",
    authBootState: "signed_in_hydrated",
    blockedUsers: [],
    userData: { id: "viewer-1", username: "viewer" },
  }),
}));

jest.mock("../../../app-shell/onboarding", () => ({
  TourAnchor: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("../../../app-shell/navigation/hooks/useIntentNavigation", () => ({
  useOpenAlbumView: () => () => undefined,
  useOpenEventDetail: () => () => undefined,
  useOpenProfile: () => () => undefined,
}));

jest.mock("../../../features/content-cards/ui/discovery/DiscoveryAlbumGridCard", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    DiscoveryAlbumGridCard: ({ item }: { item: { title?: string } }) =>
      React.createElement(Text, null, item.title || "album"),
  };
});

jest.mock("../../../features/content-cards/ui/discovery/DiscoveryEventGridCard", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    DiscoveryEventGridCard: ({ item }: { item: { title?: string } }) =>
      React.createElement(Text, null, item.title || "event"),
  };
});

jest.mock("../../../features/content-cards/ui/discovery/DiscoveryUserGridCard", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    DiscoveryUserGridCard: ({ item }: { item: { username?: string } }) =>
      React.createElement(Text, null, item.username || "user"),
  };
});

jest.mock("../../../shared/components", () => {
  const React = require("react");
  const { View } = require("react-native");
  const actual = jest.requireActual("../../../shared/components");

  const AppFlatList = React.forwardRef(
    (
      {
        data = [],
        keyExtractor,
        ListFooterComponent,
        renderItem,
      }: {
        data?: unknown[];
        keyExtractor?: (item: unknown, index: number) => string;
        ListFooterComponent?: React.ReactNode;
        renderItem?: (params: { index: number; item: unknown }) => React.ReactNode;
      },
      _ref: React.ForwardedRef<unknown>,
    ) =>
      React.createElement(
        View,
        null,
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

const mockedUseSearchResults = useSearchResults as jest.MockedFunction<typeof useSearchResults>;

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

describe("SearchScreen smoke", () => {
  beforeEach(() => {
    mockedUseSearchResults.mockReturnValue({
      activeFilterCount: 0,
      albumRelationByClub: {},
      bottomPadding: 32,
      currentError: null,
      currentLoading: false,
      emptyText: "Sonuç yok",
      filteredAlbums: [
        {
          id: "album-1",
          title: "Campus Memories",
        },
      ],
      filteredClubs: [],
      filteredEvents: [],
      filteredStudents: [],
      grid: {
        cardHeight: 196,
        cardWidth: 168,
        horizontalPadding: 10,
        mediaHeight: 118,
        rowGap: 8,
      },
      listRef: createRef<any>(),
      loadMore: async () => undefined,
      loadingMore: false,
      numColumns: 2,
      onRefresh: async () => undefined,
      onSelectType: () => undefined,
      prefetchEventById: async () => undefined,
      prefetchProfileByUsername: async () => undefined,
      query: "",
      refreshing: false,
      seedProfileOverviewSummary: () => undefined,
      selectedCategory: "",
      selectedFee: "",
      selectedUniversity: "",
      setQuery: () => undefined,
      setSelectedCategory: () => undefined,
      setSelectedFee: () => undefined,
      setSelectedUniversity: () => undefined,
      setShowFilters: () => undefined,
      setSortOption: () => undefined,
      setViewerIndex: () => undefined,
      setViewerType: () => undefined,
      setWarningMessage: () => undefined,
      showFilters: false,
      sortOption: "newest",
      supportsFilters: true,
      type: "albums",
      userData: {
        id: "viewer-1",
        username: "viewer",
      },
      viewerIndex: 0,
      viewerType: null,
      viewportPrefetch: {
        onViewableItemsChanged: () => undefined,
        viewabilityConfig: {},
      },
      warningMessage: null,
    } as any);
  });

  it("renders the search screen without crashing", () => {
    const screen = renderWithProviders(
      <SearchScreen
        navigation={
          {
            navigate: () => undefined,
          } as any
        }
        route={{ key: "Search", name: "Search" } as any}
      />,
    );

    expect(screen.getByText("Campus Memories")).toBeTruthy();
  });
});
