import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import { SEARCH_DISCOVERY_SCOPE } from "../data";
import { useSearchProjectionState } from "./useSearchProjectionState";

const mockPrefetchProjectionScreen = jest.fn((params: unknown) => Promise.resolve(params));
const mockResolveNetworkBudget = jest.fn(() => ({
  allowIdlePrefetch: true,
  allowIntentPrefetch: true,
}));
const mockUseProjectionScreen = jest.fn((params: unknown) => params);
const mockUseScreenRefresh = jest.fn((_params: unknown) => jest.fn());

jest.mock("../../../data/projections/networkAwareBudget", () => ({
  resolveNetworkBudget: () => mockResolveNetworkBudget(),
}));

jest.mock("../../../data/projections/prefetch/prefetchProjection", () => ({
  prefetchProjectionScreen: (params: unknown) => mockPrefetchProjectionScreen(params),
}));

jest.mock("../../../data/projections/screen/useProjectionScreen", () => ({
  useProjectionScreen: (params: unknown) => mockUseProjectionScreen(params),
}));

jest.mock("../../../data/projections/screen/useScreenRefresh", () => ({
  useScreenRefresh: (params: unknown) => mockUseScreenRefresh(params),
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useSearchProjectionState", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPrefetchProjectionScreen.mockClear();
    mockResolveNetworkBudget.mockClear();
    mockUseProjectionScreen.mockReset();
    mockUseScreenRefresh.mockClear();
    mockUseProjectionScreen.mockReturnValue({
      hasCachedSnapshot: true,
      items: [{ id: "album-1" }],
      loadingMore: false,
      onBackgroundRefresh: jest.fn(async () => undefined),
      onRefresh: jest.fn(async () => undefined),
      query: {
        error: null,
        fetchStatus: "idle",
        isSuccess: false,
      },
      refreshing: false,
      screenState: {
        touchedAt: 123,
      },
      shouldShowInitialSkeleton: false,
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("prefetches the other discovery tabs after the active tab settles", async () => {
    const queryClient = createQueryClient();

    renderHook(
      () =>
        useSearchProjectionState({
          searchUi: {
            effectiveSearchInput: {
              category: "",
              fee: "",
              query: "",
              sort: "newest",
              university: "",
            },
            effectiveSearchScope: SEARCH_DISCOVERY_SCOPE,
            persistedSearchScopeRef: { current: "" },
            restoreReady: true,
            type: "albums",
          } as never,
          userData: {
            id: "viewer-1",
            username: "viewer",
          } as never,
          viewerKey: "viewer-1",
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      jest.advanceTimersByTime(600);
      await Promise.resolve();
    });

    expect(mockPrefetchProjectionScreen).toHaveBeenCalledTimes(3);
    const calledQueryKeys = mockPrefetchProjectionScreen.mock.calls.map(
      (call) => (call[0] as { queryKey: unknown[] }).queryKey,
    );

    expect(calledQueryKeys).toEqual([
      projectionKeys.search("events", "viewer-1", SEARCH_DISCOVERY_SCOPE),
      projectionKeys.search("clubs", "viewer-1", SEARCH_DISCOVERY_SCOPE),
      projectionKeys.search("students", "viewer-1", SEARCH_DISCOVERY_SCOPE),
    ]);
    mockPrefetchProjectionScreen.mock.calls.forEach((call) => {
      expect(call[0]).toMatchObject({ source: "warmup" });
    });
  });

  it("skips discovery prefetch when a sibling tab is already cached", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(projectionKeys.search("events", "viewer-1", SEARCH_DISCOVERY_SCOPE), {
      ids: ["cached-event-1"],
      touchedAt: 100,
    });

    renderHook(
      () =>
        useSearchProjectionState({
          searchUi: {
            effectiveSearchInput: {
              category: "",
              fee: "",
              query: "",
              sort: "newest",
              university: "",
            },
            effectiveSearchScope: SEARCH_DISCOVERY_SCOPE,
            persistedSearchScopeRef: { current: "" },
            restoreReady: true,
            type: "albums",
          } as never,
          userData: {
            id: "viewer-1",
            username: "viewer",
          } as never,
          viewerKey: "viewer-1",
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      jest.advanceTimersByTime(600);
      await Promise.resolve();
    });

    expect(mockPrefetchProjectionScreen).toHaveBeenCalledTimes(2);
    const calledQueryKeys = mockPrefetchProjectionScreen.mock.calls.map(
      (call) => (call[0] as { queryKey: unknown[] }).queryKey,
    );

    expect(calledQueryKeys).toEqual([
      projectionKeys.search("clubs", "viewer-1", SEARCH_DISCOVERY_SCOPE),
      projectionKeys.search("students", "viewer-1", SEARCH_DISCOVERY_SCOPE),
    ]);
  });
});
