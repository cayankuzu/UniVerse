import { renderHook } from "@testing-library/react-native";
import { useHomeProjectionState } from "./useHomeProjectionState";

const mockUseQuery = jest.fn();
const mockUseQueryClient = jest.fn();
const mockReadProjectionItems = jest.fn();
const mockUseProjectionScreen = jest.fn();
const mockUseScreenRefresh = jest.fn();
const mockGetNotificationBadgeQueryDef = jest.fn();
const mockCreateStableQueryOptions = jest.fn();
const mockPersistWarmupHomeScope = jest.fn();
const mockGetHomeFeedQueryDef = jest.fn();
const mockPersistHomeStartupSnapshot = jest.fn();
const mockUseHomeStartupSnapshot = jest.fn();
const mockUseHomeDeferredProfileSupplement = jest.fn();
const mockUseHomePerceivedSpeedGate = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useQueryClient: (...args: unknown[]) => mockUseQueryClient(...args),
}));

jest.mock("../../../data/notifications", () => ({
  getNotificationBadgeQueryDef: (...args: unknown[]) => mockGetNotificationBadgeQueryDef(...args),
}));

jest.mock("../../../data/projections", () => ({
  projectionKeys: {
    notifications: (...args: unknown[]) => ["notifications", ...args],
  },
  readProjectionItems: (...args: unknown[]) => mockReadProjectionItems(...args),
}));

jest.mock("../../../data/projections/screen/useProjectionScreen", () => ({
  useProjectionScreen: (...args: unknown[]) => mockUseProjectionScreen(...args),
}));

jest.mock("../../../data/projections/screen/useScreenRefresh", () => ({
  useScreenRefresh: (...args: unknown[]) => mockUseScreenRefresh(...args),
}));

jest.mock("../../../data/query/options", () => ({
  createStableQueryOptions: (...args: unknown[]) => mockCreateStableQueryOptions(...args),
}));

jest.mock("../data", () => ({
  persistWarmupHomeScope: (...args: unknown[]) => mockPersistWarmupHomeScope(...args),
}));

jest.mock("../data/homeRepository", () => ({
  getHomeFeedQueryDef: (...args: unknown[]) => mockGetHomeFeedQueryDef(...args),
}));

jest.mock("../data/homeStartupSnapshot", () => ({
  persistHomeStartupSnapshot: (...args: unknown[]) => mockPersistHomeStartupSnapshot(...args),
  useHomeStartupSnapshot: (...args: unknown[]) => mockUseHomeStartupSnapshot(...args),
}));

jest.mock("./useHomeDeferredProfileSupplement", () => ({
  useHomeDeferredProfileSupplement: (...args: unknown[]) =>
    mockUseHomeDeferredProfileSupplement(...args),
}));

jest.mock("./useHomePerceivedSpeedGate", () => ({
  useHomePerceivedSpeedGate: (...args: unknown[]) => mockUseHomePerceivedSpeedGate(...args),
}));

describe("useHomeProjectionState", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseQueryClient.mockReset();
    mockReadProjectionItems.mockReset();
    mockUseProjectionScreen.mockReset();
    mockUseScreenRefresh.mockReset();
    mockGetNotificationBadgeQueryDef.mockReset();
    mockCreateStableQueryOptions.mockReset();
    mockPersistWarmupHomeScope.mockReset();
    mockGetHomeFeedQueryDef.mockReset();
    mockPersistHomeStartupSnapshot.mockReset();
    mockUseHomeStartupSnapshot.mockReset();
    mockUseHomeDeferredProfileSupplement.mockReset();
    mockUseHomePerceivedSpeedGate.mockReset();

    mockUseQueryClient.mockReturnValue({});
    mockReadProjectionItems.mockReturnValue([]);
    mockUseScreenRefresh.mockReturnValue(jest.fn());
    mockCreateStableQueryOptions.mockReturnValue({});
    mockUseQuery.mockReturnValue({ data: undefined });
    mockGetNotificationBadgeQueryDef.mockReturnValue({
      queryFn: jest.fn(),
      queryKey: ["badge", "home"],
      staleTime: 1000,
    });
    mockGetHomeFeedQueryDef.mockReturnValue({
      entity: "home-feed",
      filterScope: "all:all:all:newest",
      queryKey: ["screen", "home", "viewer-1", "all:all:all:newest"],
      viewerKey: "viewer-1",
    });
    mockUseProjectionScreen.mockReturnValue({
      backgroundRefreshing: false,
      items: [],
      loadingMore: false,
      onRefresh: jest.fn(),
      query: {
        isFetching: false,
        isSuccess: true,
      },
      refreshing: false,
      screenState: {
        ids: ["event:event-1"],
        touchedAt: 123,
      },
      shouldShowInitialSkeleton: false,
    });
    mockUseHomeStartupSnapshot.mockReturnValue({
      items: [{ id: "event:event-1", kind: "event" }],
      savedAt: Date.now(),
      unreadCount: 3,
    });
    mockUseHomePerceivedSpeedGate.mockImplementation(
      (params: { hasImmediateContent: boolean }) => ({
        allowImmediateContent: params.hasImmediateContent,
        allowMediaUpgrade: false,
        allowPrefetch: false,
        allowSecondaryReads: false,
      }),
    );
  });

  it("keeps the startup preview active when restore only rehydrates screen ids without entity rows", () => {
    const { result } = renderHook(() =>
      useHomeProjectionState({
        blockedUsers: [],
        uiState: {
          deferredEntityFilter: "all",
          deferredSortOption: "newest",
          deferredSourceFilter: "all",
          deferredTypeFilter: "all",
          hasUserInteracted: false,
          restoreReady: true,
        } as any,
        userData: {
          id: "viewer-1",
          username: "viewer",
        } as any,
        viewer: {
          accountType: "student",
          id: "viewer-1",
          username: "viewer",
        },
        viewerKey: "viewer-1",
      }),
    );

    expect(result.current.hasHomeProjectionContent).toBe(false);
    expect(result.current.hasHomeProjectionSnapshot).toBe(true);
    expect(result.current.shouldUseStartupPreview).toBe(true);
    expect(mockUseHomePerceivedSpeedGate).toHaveBeenCalledWith(
      expect.objectContaining({
        hasImmediateContent: true,
      }),
    );
    expect(mockPersistHomeStartupSnapshot).not.toHaveBeenCalled();
  });
});
