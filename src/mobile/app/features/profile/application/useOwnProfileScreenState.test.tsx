import { act, renderHook } from "@testing-library/react-native";

const mockProjectionRefresh = jest.fn(async () => undefined);
const mockRelationsRefresh = jest.fn(async () => undefined);
const mockSetAlbumOwnerFilterExpanded = jest.fn();
const mockSetTab = jest.fn();

jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
jest.mock("../../../shared/layout/bottomNavSpacing", () => ({ useBottomNavPadding: () => 0 }));
jest.mock("../../../shared/hooks/useScrollToTopOnReselect", () => ({
  useScrollToTopOnReselect: jest.fn(),
}));
jest.mock("../../../data/projections/prefetch/useContentIntentPrefetch", () => ({
  useContentIntentPrefetch: () => ({
    prefetchEventById: jest.fn(),
    prefetchProfileByUsername: jest.fn(),
  }),
}));
jest.mock("../../../data/social", () => ({
  useViewerRelations: () => ({ buildRelationByClub: jest.fn(), refetch: mockRelationsRefresh }),
}));
jest.mock("../../../data/errors/appDataError", () => ({
  mapAppDataErrorMessage: () => "error",
}));
jest.mock("../../../shared/i18n", () => ({ t: (key: string) => key }));
jest.mock("./profileCollections", () => ({
  createBlockedProfileSetExcludingSelf: () => new Set(),
}));
jest.mock("./useProfileCollectionsState", () => ({
  useProfileCollectionsState: () => ({
    albumRelationByClub: new Map(),
    albums: [],
    emptyText: "empty",
    eventRelationByClub: new Map(),
    events: [],
    tabs: [],
    tileData: [],
  }),
}));
jest.mock("./useProfileGridLayout", () => ({
  useProfileGridLayout: () => ({ grid: {}, numColumns: 3 }),
}));
jest.mock("./useOwnProfileScreenUiState", () => ({
  useOwnProfileScreenUiState: () => ({
    albumOwnerFilter: "all",
    albumOwnerFilterExpanded: false,
    listRef: { current: null },
    setAlbumOwnerFilter: jest.fn(),
    setAlbumOwnerFilterExpanded: mockSetAlbumOwnerFilterExpanded,
    setTab: mockSetTab,
    tab: "album",
  }),
}));
jest.mock("./profilePrefetch", () => ({
  useProfileExperiencePrefetch: jest.fn(),
  useProfileViewportPrefetch: () => ({}),
}));
jest.mock("./useOwnProfileProjectionState", () => ({
  useOwnProfileProjectionState: () => ({
    activeProjection: {
      hasMore: false,
      loadMore: jest.fn(),
      loadingMore: false,
      query: { isFetching: false },
    },
    albumProjection: { query: { isFetching: false } },
    eventProjection: { query: { isFetching: false } },
    loadingMore: false,
    onRefresh: mockProjectionRefresh,
    overviewQuery: { error: null, isLoading: false },
    profileBootstrap: { isBootstrapping: false },
    profileTab: "album",
    refreshing: false,
    resolvedAccountType: "student",
    resolvedProfile: { username: "alice" },
    resolvedUserData: { id: "viewer-id", username: "alice" },
    sourceAlbums: [],
    sourceEvents: [],
  }),
}));

import { useOwnProfileScreenState } from "./useOwnProfileScreenState";

describe("useOwnProfileScreenState actions", () => {
  it("keeps navigation callbacks direct and refreshes projections in parallel", async () => {
    const openFollowers = jest.fn();
    const openFollowing = jest.fn();
    const openSettings = jest.fn();
    const { result } = renderHook(() =>
      useOwnProfileScreenState({
        accountType: "student",
        blockedUsers: [],
        onCloseViewer: jest.fn(),
        openAlbumView: jest.fn(),
        openEventDetail: jest.fn(),
        openFollowers,
        openFollowing,
        openProfile: jest.fn(),
        openSettings,
        profileReselectCounter: 0,
        userData: { id: "viewer-id", username: "alice" } as never,
      }),
    );

    act(() => {
      result.current.handleOpenSettings();
      result.current.handleOpenFollowers();
      result.current.handleOpenFollowing();
      result.current.handleSetTab("events");
    });
    await act(async () => result.current.onRefresh());

    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(openFollowers).toHaveBeenCalledTimes(1);
    expect(openFollowing).toHaveBeenCalledTimes(1);
    expect(mockSetTab).toHaveBeenCalledWith("events");
    expect(mockSetAlbumOwnerFilterExpanded).toHaveBeenCalledWith(false);
    expect(mockProjectionRefresh).toHaveBeenCalledTimes(1);
    expect(mockRelationsRefresh).toHaveBeenCalledTimes(1);
  });
});
