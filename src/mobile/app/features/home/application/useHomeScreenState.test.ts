import { renderHook } from "@testing-library/react-native";
import { useHomeScreenState } from "./useHomeScreenState";

const mockUseViewerRelations = jest.fn();
const mockUseHomeFeedCollections = jest.fn();
const mockUseHomeProjectionState = jest.fn();
const mockUseHomeScreenPrefetch = jest.fn();
const mockUseHomeVisibleMediaUpgrade = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({}),
}));

jest.mock("../../../shared/layout/bottomNavSpacing", () => ({
  useBottomNavPadding: () => 24,
}));

jest.mock("../../../shared/hooks/useScrollToTopOnReselect", () => ({
  useScrollToTopOnReselect: () => undefined,
}));

jest.mock("../../../shared/loading/stagedLoad", () => ({
  resolveStagedLoadState: () => "idle",
}));

jest.mock("../../../shared/i18n", () => ({
  t: () => "",
}));

jest.mock("../../../data/social", () => ({
  useViewerRelations: (...args: unknown[]) => mockUseViewerRelations(...args),
}));

jest.mock("../../../data/errors/appDataError", () => ({
  mapAppDataErrorMessage: () => "error",
}));

jest.mock("../../../platform/logging/logger", () => ({
  debugLog: () => undefined,
}));

jest.mock("./useHomeFeedCollections", () => ({
  useHomeFeedCollections: (...args: unknown[]) => mockUseHomeFeedCollections(...args),
}));

jest.mock("./useHomeScreenUiState", () => ({
  useHomeScreenUiState: () => ({
    activeFilterCount: 0,
    defaultSource: "all",
    deferredEntityFilter: "all",
    deferredSortOption: "newest",
    deferredSourceFilter: "all",
    deferredTypeFilter: "all",
    entityFilter: "all",
    hasUserInteracted: false,
    listRef: { current: null },
    markUserInteracted: jest.fn(),
    restoreReady: true,
    setEntityFilter: jest.fn(),
    setShowFilters: jest.fn(),
    setSortOption: jest.fn(),
    setSourceFilter: jest.fn(),
    setTypeFilter: jest.fn(),
    setViewerIndex: jest.fn(),
    setWarningMessage: jest.fn(),
    showFilters: false,
    sortOption: "newest",
    sourceFilter: "all",
    typeFilter: "all",
    viewerIndex: null,
    warningMessage: null,
  }),
}));

jest.mock("../../../data/contracts/viewerKey", () => ({
  getViewerKey: () => "viewer-1",
}));

jest.mock("./useHomeProjectionState", () => ({
  useHomeProjectionState: (...args: unknown[]) => mockUseHomeProjectionState(...args),
}));

jest.mock("./useHomeScreenPrefetch", () => ({
  useHomeScreenPrefetch: (...args: unknown[]) => mockUseHomeScreenPrefetch(...args),
}));

jest.mock("./useHomeVisibleMediaUpgrade", () => ({
  useHomeVisibleMediaUpgrade: (...args: unknown[]) => mockUseHomeVisibleMediaUpgrade(...args),
}));

const viewerRelationsValue = {
  buildRelationByClub: jest.fn(() => ({})),
  clubPrivacyMap: {},
  followingClubUsernames: new Set<string>(),
  followingStudentUsernames: new Set<string>(),
  followingUsernames: new Set<string>(),
  isLoading: true,
  relationByClub: {},
};

const collectionsValue = {
  albumRelationByClub: {},
  effectiveItems: [],
  eventRelationByClub: {},
  nextPageImageItems: [],
  tourAlbumIndex: 0,
  tourEventIndex: 0,
  visibleAlbums: [],
  visibleEvents: [],
};

const projectionStateValue = {
  filterScope: "all:all:all:newest",
  hasHomeProjectionContent: false,
  homeProjection: {
    backgroundRefreshing: false,
    items: [],
    loadMore: jest.fn(),
    loadingMore: false,
    onRefresh: jest.fn(),
    query: {
      error: null,
      isFetching: false,
    },
    screenState: {
      ids: [],
    },
    shouldShowInitialSkeleton: false,
  },
  onRefresh: jest.fn(),
  refreshing: false,
  shouldUseStartupPreview: true,
  speedGate: {
    allowMediaUpgrade: false,
    allowPrefetch: false,
    allowSecondaryReads: true,
  },
  startupPreviewItems: [
    {
      id: "event:event-1",
      kind: "event",
    },
  ],
  unread: 0,
};

const prefetchStateValue = {
  onNotificationsPressIn: jest.fn(),
  onViewableItemsChanged: jest.fn(),
  viewabilityConfig: {},
};

const mediaUpgradeStateValue = {
  onViewableItemsChanged: jest.fn(),
  readyMediaRowKeys: new Set<string>(),
};

describe("useHomeScreenState", () => {
  beforeEach(() => {
    mockUseViewerRelations.mockReset();
    mockUseHomeFeedCollections.mockReset();
    mockUseHomeProjectionState.mockReset();
    mockUseHomeScreenPrefetch.mockReset();
    mockUseHomeVisibleMediaUpgrade.mockReset();

    mockUseViewerRelations.mockReturnValue(viewerRelationsValue);
    mockUseHomeFeedCollections.mockReturnValue(collectionsValue);
    mockUseHomeProjectionState.mockReturnValue(projectionStateValue);
    mockUseHomeScreenPrefetch.mockReturnValue(prefetchStateValue);
    mockUseHomeVisibleMediaUpgrade.mockReturnValue(mediaUpgradeStateValue);
  });

  it("waits for the relationship snapshot before enforcing follow visibility on startup preview content", () => {
    renderHook(() =>
      useHomeScreenState({
        accountType: "student",
        blockedUsers: [],
        homeReselectCounter: 0,
        userData: {
          categories: [],
          coverImage: "",
          email: "viewer@example.com",
          events: 0,
          followers: 0,
          following: 0,
          id: "viewer-1",
          profileImage: "",
          university: "",
          username: "viewer",
        },
      }),
    );

    expect(mockUseViewerRelations).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        viewerId: "viewer-1",
        viewerUsername: "viewer",
      }),
    );
    expect(mockUseHomeFeedCollections).toHaveBeenCalledWith(
      expect.objectContaining({
        enforceFollowVisibility: false,
        useStartupPreview: true,
      }),
    );
  });
});
