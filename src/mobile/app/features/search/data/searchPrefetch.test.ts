import { projectionKeys } from "../../../data/projections/projectionKeys";
import { SEARCH_DISCOVERY_SCOPE } from "../../../data/projections/searchDiscovery";
import { prefetchSearchLandingExperience } from "./searchPrefetch";
import { QueryClient } from "@tanstack/react-query";

const mockPrefetchProjectionScreen = jest.fn((params: unknown) => Promise.resolve(params));

jest.mock("../../../data/projections/prefetch/prefetchProjection", () => ({
  prefetchProjectionScreen: (params: unknown) => mockPrefetchProjectionScreen(params),
}));

describe("prefetchSearchLandingExperience", () => {
  beforeEach(() => {
    mockPrefetchProjectionScreen.mockClear();
  });

  it("prefetches only the default visible discovery tab", async () => {
    await prefetchSearchLandingExperience({
      queryClient: new QueryClient(),
      viewer: {
        id: "viewer-1",
        username: "viewer",
      },
    });

    expect(mockPrefetchProjectionScreen).toHaveBeenCalledTimes(1);
    const calledQueryKeys = mockPrefetchProjectionScreen.mock.calls.map(
      (call) => (call[0] as { queryKey: unknown[] }).queryKey,
    );

    expect(calledQueryKeys).toEqual([
      projectionKeys.search("albums", "viewer-1", SEARCH_DISCOVERY_SCOPE),
    ]);
  });

  it("skips prefetch when the viewer username is unavailable", async () => {
    await prefetchSearchLandingExperience({
      queryClient: new QueryClient(),
      viewer: {
        id: "viewer-1",
        username: "",
      },
    });

    expect(mockPrefetchProjectionScreen).not.toHaveBeenCalled();
  });

  it("prefetches only the last active search scope when available", async () => {
    await prefetchSearchLandingExperience({
      preferredScope: {
        kind: "events",
        queryText: "konser",
        scope: "events:konser:::newest:",
        sortMode: "newest",
        updatedAt: new Date().toISOString(),
      },
      queryClient: new QueryClient(),
      viewer: {
        id: "viewer-1",
        username: "viewer",
      },
    });

    expect(mockPrefetchProjectionScreen).toHaveBeenCalledTimes(1);
    const firstCall = mockPrefetchProjectionScreen.mock.calls[0]?.[0] as {
      queryKey: unknown[];
    };
    expect(firstCall.queryKey).toEqual(
      projectionKeys.search("events", "viewer-1", "events:konser:::newest:"),
    );
  });
});
