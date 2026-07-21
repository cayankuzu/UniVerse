import React from "react";
import { render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { appTheme } from "../../../../shared/theme";
import { ViewProfileScreen } from "./ViewProfileScreen";
import { useViewProfile } from "../../application/useViewProfile";

jest.mock("expo-video", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    VideoView: (props: Record<string, unknown>) => React.createElement(View, props),
    useVideoPlayer: () => null,
  };
});

jest.mock("../../application/useViewProfile", () => ({
  useViewProfile: jest.fn(),
}));

jest.mock("../../../../app-shell/auth", () => ({
  useAuth: () => ({
    accountType: "student",
    authBootState: "signed_in_hydrated",
    blockUser: async () => undefined,
    blockedUsers: [],
    isBlocked: () => false,
    unblockUser: async () => undefined,
    userData: { id: "viewer-1", username: "viewer" },
  }),
}));

jest.mock("../../../../app-shell/navigation/hooks/useIntentNavigation", () => ({
  useOpenAlbumView: () => () => undefined,
  useOpenEventDetail: () => () => undefined,
  useOpenProfileWithOptions: () => () => undefined,
}));

jest.mock("../../../../shared/components", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
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
    BackHeader: ({ title }: { title?: string }) =>
      title ? React.createElement(React.Fragment, null, title) : null,
    GradientButton: ({ label, onPress }: { label: string; onPress?: () => void }) =>
      React.createElement(Text, { onPress }, label),
  };
});

jest.mock("../../../../data/projections/prefetch/useContentIntentPrefetch", () => ({
  useContentIntentPrefetch: () => ({
    prefetchEventById: async () => undefined,
    prefetchProfileByUsername: async () => undefined,
  }),
}));

const mockedUseViewProfile = useViewProfile as jest.MockedFunction<typeof useViewProfile>;

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

function createViewProfileState(overrides: Record<string, unknown> = {}) {
  return {
    accountType: "student",
    albumOwnerFilter: "all",
    albumOwnerFilterExpanded: false,
    albumRelationByClub: {},
    albums: [],
    albumsQuery: { error: null, isLoading: false },
    canViewContent: true,
    canViewFollowers: true,
    canViewFollowing: true,
    contentLockedMessage: "",
    contentWarningMessage: null,
    displayName: "Cyn User",
    emptyText: "İçerik yok",
    eventRelationByClub: {},
    events: [],
    eventsQuery: { error: null, isLoading: false },
    followersAccess: { allowed: true, warningMessage: null },
    followAction: { confirmation: null, run: () => undefined, targetStatus: "following" },
    followLabel: "Takip Et",
    followMutation: { isPending: false },
    followStatus: "none",
    followVariant: "primary",
    followingAccess: { allowed: true, warningMessage: null },
    grid: {
      cardHeight: 196,
      cardWidth: 168,
      horizontalPadding: 10,
      mediaHeight: 118,
      rowGap: 8,
    },
    insets: { bottom: 34 },
    isClub: false,
    isLockedProfile: false,
    isOwnProfile: false,
    isTargetBlocked: false,
    loadMore: async () => undefined,
    loadingMore: false,
    numColumns: 2,
    onRefresh: async () => undefined,
    privateNoticeText: null,
    profile: {
      accountType: "student",
      categories: ["Music"],
      coverImage: null,
      department: "Computer Science",
      followersCount: 12,
      followingCount: 5,
      gradeYear: "2027",
      hideEmail: false,
      id: "profile-1",
      name: "Cyn User",
      profileImage: null,
      university: "Uni",
      username: "cyn",
    },
    profileCapabilities: null,
    profileLoading: false,
    profileQuery: { error: null },
    refreshing: false,
    runBlockToggle: async () => undefined,
    runReport: async () => undefined,
    setAlbumOwnerFilter: () => undefined,
    setAlbumOwnerFilterExpanded: () => undefined,
    setShowMenu: () => undefined,
    setTab: () => undefined,
    setViewerImage: () => undefined,
    setViewerIndex: () => undefined,
    setViewerType: () => undefined,
    setWarningMessage: () => undefined,
    showMenu: false,
    showPrivateNotice: false,
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
        username: "cyn",
      },
    ],
    userData: { id: "viewer-1", username: "viewer" },
    userIsBlocked: false,
    viewerCacheKey: "viewer-1",
    viewerImage: null,
    viewerIndex: 0,
    viewerType: null,
    viewportPrefetch: {
      onViewableItemsChanged: () => undefined,
      viewabilityConfig: {},
    },
    warningMessage: null,
    ...overrides,
  } as any;
}

describe("ViewProfileScreen smoke", () => {
  beforeEach(() => {
    mockedUseViewProfile.mockReturnValue(createViewProfileState());
  });

  it("renders another user's profile without crashing", () => {
    const screen = renderWithProviders(
      <ViewProfileScreen
        navigation={
          {
            goBack: () => undefined,
            navigate: () => undefined,
            push: () => undefined,
          } as any
        }
        route={
          {
            key: "ViewProfile-cyn",
            name: "ViewProfile",
            params: { username: "cyn" },
          } as any
        }
      />,
    );

    expect(screen.getByText("Cyn User")).toBeTruthy();
    expect(screen.getByText("@cyn")).toBeTruthy();
    expect(screen.getByTestId("profile-outer-scroll")).toBeTruthy();
    expect(screen.getByTestId("profile-content-pager")).toBeTruthy();
    expect(screen.getByTestId("profile-static-grid-album")).toBeTruthy();
  });

  it("renders blocked profile actions without crashing", () => {
    mockedUseViewProfile.mockReturnValue(createViewProfileState({ userIsBlocked: true }));

    const screen = renderWithProviders(
      <ViewProfileScreen
        navigation={
          {
            goBack: () => undefined,
            navigate: () => undefined,
            push: () => undefined,
          } as any
        }
        route={
          {
            key: "ViewProfile-cyn-blocked",
            name: "ViewProfile",
            params: { username: "cyn" },
          } as any
        }
      />,
    );

    expect(screen.getByText("Engeli Kaldır")).toBeTruthy();
    expect(screen.getByText("Şikâyet Et")).toBeTruthy();
  });

  it("keeps the full profile header visible for private profiles while hiding content", () => {
    mockedUseViewProfile.mockReturnValue(
      createViewProfileState({
        canViewContent: false,
        contentLockedMessage: "Locked content",
        emptyText: "Locked content",
        privateNoticeText: "Private account",
        showPrivateNotice: true,
        tabs: [
          { key: "album", label: "Albums", count: 3 },
          { key: "events", label: "Events", count: 4 },
        ],
        tileData: [],
      }),
    );

    const screen = renderWithProviders(
      <ViewProfileScreen
        navigation={
          {
            goBack: () => undefined,
            navigate: () => undefined,
            push: () => undefined,
          } as any
        }
        route={
          {
            key: "ViewProfile-cyn-private",
            name: "ViewProfile",
            params: { username: "cyn" },
          } as any
        }
      />,
    );

    expect(screen.getByText("Cyn User")).toBeTruthy();
    expect(screen.getByText("Computer Science")).toBeTruthy();
    expect(screen.getByText("Music")).toBeTruthy();
    expect(screen.getByText("Private account")).toBeTruthy();
    expect(screen.getByText("Albums")).toBeTruthy();
    expect(screen.getByText("Events")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
  });
});
