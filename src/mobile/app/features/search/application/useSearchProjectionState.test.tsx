import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react-native";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import { SEARCH_DISCOVERY_SCOPE } from "../data";
import { useSearchProjectionState } from "./useSearchProjectionState";

const mockUseProjectionScreen = jest.fn();
const mockUseScreenRefresh = jest.fn((_params: unknown) => jest.fn());

jest.mock("../../../data/projections/screen/useProjectionScreen", () => ({
  useProjectionScreen: (params: unknown) => mockUseProjectionScreen(params),
}));

jest.mock("../../../data/projections/screen/useScreenRefresh", () => ({
  useScreenRefresh: (params: unknown) => mockUseScreenRefresh(params),
}));

function createProjection(id: string) {
  return {
    hasCachedSnapshot: true,
    items: [{ id }],
    loadingMore: false,
    onRefresh: jest.fn(async () => undefined),
    query: { error: null, fetchStatus: "idle", isSuccess: true },
    refreshing: false,
    screenState: { touchedAt: 123 },
    shouldShowInitialSkeleton: false,
  };
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function createSearchUi(type: "albums" | "events" | "clubs" | "students") {
  return {
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
    type,
  } as never;
}

describe("useSearchProjectionState", () => {
  beforeEach(() => {
    mockUseProjectionScreen.mockReset();
    mockUseScreenRefresh.mockClear();
    mockUseProjectionScreen.mockImplementation((params: { entity: string }) =>
      createProjection(params.entity),
    );
  });

  it("mounts all discovery projections and exposes every preloaded list", () => {
    const { result } = renderHook(
      () =>
        useSearchProjectionState({
          searchUi: createSearchUi("albums"),
          userData: { id: "viewer-1", username: "viewer" } as never,
          viewerKey: "viewer-1",
        }),
      { wrapper: createWrapper() },
    );

    expect(mockUseProjectionScreen).toHaveBeenCalledTimes(4);
    expect(mockUseProjectionScreen.mock.calls.map((call) => call[0].queryKey)).toEqual([
      projectionKeys.search("albums", "viewer-1", SEARCH_DISCOVERY_SCOPE),
      projectionKeys.search("events", "viewer-1", SEARCH_DISCOVERY_SCOPE),
      projectionKeys.search("clubs", "viewer-1", SEARCH_DISCOVERY_SCOPE),
      projectionKeys.search("students", "viewer-1", SEARCH_DISCOVERY_SCOPE),
    ]);
    expect(result.current.itemsByType.albums).toEqual([{ id: "search-albums" }]);
    expect(result.current.itemsByType.events).toEqual([{ id: "search-events" }]);
    expect(result.current.itemsByType.clubs).toEqual([{ id: "search-users" }]);
    expect(result.current.itemsByType.students).toEqual([{ id: "search-users" }]);
  });

  it("changes only the selected projection when swiping between loaded tabs", () => {
    let type: "albums" | "events" = "albums";
    const { rerender, result } = renderHook(
      () =>
        useSearchProjectionState({
          searchUi: createSearchUi(type),
          userData: { id: "viewer-1", username: "viewer" } as never,
          viewerKey: "viewer-1",
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.searchProjection.items).toEqual([{ id: "search-albums" }]);
    type = "events";
    rerender({});

    expect(result.current.searchProjection.items).toEqual([{ id: "search-events" }]);
    expect(mockUseProjectionScreen.mock.calls.slice(-4).map((call) => call[0].queryKey)).toEqual([
      projectionKeys.search("albums", "viewer-1", SEARCH_DISCOVERY_SCOPE),
      projectionKeys.search("events", "viewer-1", SEARCH_DISCOVERY_SCOPE),
      projectionKeys.search("clubs", "viewer-1", SEARCH_DISCOVERY_SCOPE),
      projectionKeys.search("students", "viewer-1", SEARCH_DISCOVERY_SCOPE),
    ]);
  });
});
