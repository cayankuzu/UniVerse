import React, { createRef } from "react";
import { render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { appTheme } from "../../../shared/theme";
import { HomeScreen } from "./HomeScreen";
import { useHomeScreenState } from "../application/useHomeScreenState";
import { useAlbumFeedCardState } from "../../content-cards/ui/feed/useAlbumFeedCardState";
import { useDeferredAlbumFeedCardState } from "../../content-cards/application/useDeferredAlbumFeedCardState";
import { useDeferredEventFeedCardState } from "../../content-cards/application/useDeferredEventFeedCardState";
import { useEventCardState } from "../../content-cards/ui/homeEventCard/useEventCardState";
import { useAuth } from "../../../app-shell/auth";

jest.mock("expo-image", () => {
  const React = require("react");
  const MockExpoImage = (props: Record<string, unknown>) => React.createElement("ExpoImage", props);
  return {
    Image: Object.assign(MockExpoImage, {
      getCachePathAsync: jest.fn(() => new Promise(() => undefined)),
    }),
  };
});

jest.mock("../application/useHomeScreenState", () => ({
  useHomeScreenState: jest.fn(),
}));

jest.mock("../../../app-shell/auth", () => ({
  useAuth: jest.fn(),
}));

jest.mock("../../content-cards/ui/homeEventCard/useEventCardState", () => ({
  useEventCardState: jest.fn(),
}));

jest.mock("../../content-cards/ui/feed/useAlbumFeedCardState", () => ({
  useAlbumFeedCardState: jest.fn(),
}));

jest.mock("../../content-cards/application/useDeferredEventFeedCardState", () => ({
  useDeferredEventFeedCardState: jest.fn(),
}));

jest.mock("../../content-cards/application/useDeferredAlbumFeedCardState", () => ({
  useDeferredAlbumFeedCardState: jest.fn(),
}));

jest.mock("../../../app-shell/navigation/hooks/useIntentNavigation", () => ({
  useOpenAlbumView: () => () => undefined,
  useOpenEventDetail: () => () => undefined,
  useOpenProfile: () => () => undefined,
}));

jest.mock("../../../shared/components", () => {
  const React = require("react");
  const { View } = require("react-native");
  const actual = jest.requireActual("../../../shared/components");

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

const mockedUseHomeScreenState = useHomeScreenState as jest.MockedFunction<
  typeof useHomeScreenState
>;
const mockedUseEventCardState = useEventCardState as jest.MockedFunction<typeof useEventCardState>;
const mockedUseAlbumFeedCardState = useAlbumFeedCardState as jest.MockedFunction<
  typeof useAlbumFeedCardState
>;
const mockedUseDeferredEventFeedCardState = useDeferredEventFeedCardState as jest.MockedFunction<
  typeof useDeferredEventFeedCardState
>;
const mockedUseDeferredAlbumFeedCardState = useDeferredAlbumFeedCardState as jest.MockedFunction<
  typeof useDeferredAlbumFeedCardState
>;
const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

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

describe("HomeScreen smoke", () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      accountType: "student",
      authBootState: "signed_in_hydrated",
      blockedUsers: [],
      isAuthBootstrapPending: false,
      isDemoMode: false,
      isLoggedIn: true,
      userData: {
        id: "viewer-1",
        username: "viewer",
      },
    } as any);

    mockedUseEventCardState.mockReturnValue({
      accountType: "student",
      albumDisabled: false,
      attendees: 3,
      attendeesList: [],
      attendeesLoading: false,
      attendeesRefreshing: false,
      bodyActionsEnabled: true,
      canDeleteComment: () => false,
      commentCount: 2,
      comments: [],
      commentsRefreshing: false,
      copiedField: null,
      eventActionAccess: {
        albumReason: null,
        canOpenAlbum: true,
        isEnded: false,
        reason: null,
      },
      eventMenuActions: [],
      handleAddComment: async () => undefined,
      handleCopyText: async () => undefined,
      handleDeleteComment: () => undefined,
      handleJoin: () => undefined,
      handleLike: () => undefined,
      handleOpenAttendees: async () => undefined,
      handleOpenComments: async () => undefined,
      handleOpenLikes: async () => undefined,
      handleReport: async () => undefined,
      handleReportComment: () => undefined,
      handleToggleCommentLike: async () => undefined,
      hasLocation: true,
      imagePreviewHeight: 320,
      joinDisabled: false,
      joinWarningMessage: "",
      joined: false,
      liked: false,
      loadAlbumOpenWarning: async () => null,
      likes: 4,
      likesLoading: false,
      likesRefreshing: false,
      likers: [],
      loadAttendees: async () => undefined,
      loadCommentLikers: async () => [],
      loadLikers: async () => undefined,
      locationDisabled: false,
      modalBottomPadding: 24,
      pendingStatus: null,
      refreshComments: async () => undefined,
      reportSubmitted: false,
      setShowAttendeesModal: () => undefined,
      setShowComments: () => undefined,
      setShowImagePreview: () => undefined,
      setShowLikesModal: () => undefined,
      setShowLocationModal: () => undefined,
      setShowReportModal: () => undefined,
      showAttendeesModal: false,
      showComments: false,
      showImagePreview: false,
      showLikesModal: false,
      showLocationModal: false,
      showReportModal: false,
      userData: {
        id: "viewer-1",
        name: "Viewer",
        profileImage: null,
        university: "Uni",
        username: "viewer",
      },
    } as any);

    mockedUseAlbumFeedCardState.mockReturnValue({
      buttonAction: {
        action: "open",
        label: "Etkinlige git",
      },
      canDeleteComment: () => false,
      commentCount: 1,
      comments: [],
      commentsRefreshing: false,
      handleActionPress: () => undefined,
      handleAddComment: async () => undefined,
      handleDeleteComment: () => undefined,
      handleLike: async () => undefined,
      handleOpenComments: async () => undefined,
      handleOpenLikes: async () => undefined,
      handleReportComment: () => undefined,
      handleToggleCommentLike: async () => undefined,
      liked: false,
      likes: 7,
      likesLoading: false,
      likesRefreshing: false,
      likers: [],
      loadCommentLikers: async () => [],
      loadLikers: async () => undefined,
      menuActions: [],
      previewImages: ["https://example.com/album-1.jpg"],
      previewIndex: 0,
      refreshComments: async () => undefined,
      setPreviewIndex: () => undefined,
      setShowComments: () => undefined,
      setShowImagePreview: () => undefined,
      setShowLikesModal: () => undefined,
      showComments: false,
      showImagePreview: false,
      showLikesModal: false,
      userData: {
        id: "viewer-1",
        name: "Viewer",
        profileImage: null,
        university: "Uni",
        username: "viewer",
      },
    } as any);

    mockedUseDeferredEventFeedCardState.mockReturnValue({
      accountType: "student",
      albumDisabled: false,
      attendees: 3,
      commentCount: 2,
      eventActionAccess: {
        albumReason: null,
        canOpenAlbum: true,
        isEnded: false,
        isMembersOnly: false,
        isOwnClub: false,
        reason: null,
      },
      handleJoin: async () => undefined,
      handleLike: async () => undefined,
      hasLocation: true,
      joinDisabled: false,
      joinWarningMessage: "",
      joined: false,
      liked: false,
      loadAlbumOpenWarning: async () => null,
      likes: 4,
      locationDisabled: false,
      pendingStatus: null,
    } as any);

    mockedUseDeferredAlbumFeedCardState.mockReturnValue({
      buttonAction: {
        action: "view_event",
        label: "Etkinlige git",
      },
      commentCount: 1,
      handleActionPress: () => undefined,
      handleLike: async () => undefined,
      liked: false,
      likes: 7,
    } as any);

    mockedUseHomeScreenState.mockReturnValue({
      accountType: "student",
      activeFilterCount: 0,
      albumRelationByClub: {},
      bottomPadding: 32,
      defaultSource: "all",
      entityFilter: "all",
      eventRelationByClub: {},
      filteredItems: [
        {
          id: "event-1",
          kind: "event",
          event: {
            id: "event-1",
            albumCount: 2,
            attendees: 3,
            capacity: 20,
            category: "Music",
            club: "Uni Club",
            clubImage: "https://example.com/club.jpg",
            clubUsername: "uniclub",
            comments: 2,
            createdAt: "2026-03-24T10:00:00.000Z",
            date: "2026-03-24",
            description: "Etkinlik açıklaması",
            endTime: "20:00",
            fee: "Ücretsiz",
            idempotencyKey: "event-1",
            image: "https://example.com/event.jpg",
            joined: false,
            likes: 4,
            liked: false,
            location: "Kampus",
            startDate: "2026-03-24",
            startTime: "18:00",
            title: "Spring Jam",
            type: "Concert",
            university: "Uni",
          },
        },
      ],
      isError: false,
      listRef: createRef<any>(),
      loadMore: async () => undefined,
      loadState: { isBlocking: false },
      loadingMore: false,
      onNotificationsPressIn: () => undefined,
      onRefresh: async () => undefined,
      onViewableItemsChanged: () => undefined,
      refreshing: false,
      setEntityFilter: () => undefined,
      setShowFilters: () => undefined,
      setSortOption: () => undefined,
      setSourceFilter: () => undefined,
      setTypeFilter: () => undefined,
      setViewerIndex: () => undefined,
      setWarningMessage: () => undefined,
      showFilters: false,
      sortOption: "newest",
      sourceFilter: "all",
      tourAlbumIndex: -1,
      tourEventIndex: -1,
      typeFilter: "all",
      unread: 0,
      userData: {
        id: "viewer-1",
        username: "viewer",
      },
      viewabilityConfig: {},
      viewerIndex: null,
      warningMessage: null,
    } as any);
  });

  it("renders the home screen without crashing", () => {
    const screen = renderWithProviders(
      <HomeScreen
        navigation={
          {
            navigate: () => undefined,
          } as any
        }
        route={{ key: "Home", name: "Home" } as any}
      />,
    );

    expect(screen.getByText("Spring Jam")).toBeTruthy();
    expect(screen.getByText("UniVerse")).toBeTruthy();
  });
});
