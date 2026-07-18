import { QueryClient } from "@tanstack/react-query";
import { prefetchProfileExperience } from "./prefetch/intentPrefetch";
import { projectionKeys } from "./projectionKeys";

const mockGetProfileOverviewProjection = jest.fn();
const mockLoadViewerBlockedVisibility = jest.fn();

jest.mock("./networkAwareBudget", () => ({
  resolveNetworkBudget: jest.fn(() => ({
    allowIdlePrefetch: true,
    allowImagePrefetch: true,
    allowIntentPrefetch: true,
    allowNextPagePrefetch: true,
    quality: "good",
  })),
}));

jest.mock("./performanceBudget", () => ({
  resolveProjectionPerformanceBudget: jest.fn(() => ({
    prefetchPolicy: "intent",
  })),
}));

jest.mock("../profile/profileOverviewProjection", () => ({
  getProfileOverviewProjection: (...args: unknown[]) => mockGetProfileOverviewProjection(...args),
}));

jest.mock("../social/blockedVisibility", () => {
  const actual = jest.requireActual("../social/blockedVisibility");
  return {
    ...actual,
    loadViewerBlockedVisibility: (...args: unknown[]) => mockLoadViewerBlockedVisibility(...args),
    loadViewerBlockedVisibilityOrEmpty: (...args: unknown[]) =>
      mockLoadViewerBlockedVisibility(...args),
  };
});

describe("prefetchProfileExperience", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadViewerBlockedVisibility.mockResolvedValue({
      blockedIds: new Set(["target-id"]),
      blockedUsernames: new Set(["blocked-user"]),
      viewerId: "viewer-1",
    });
  });

  it("skips blocked profile prefetches", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    await prefetchProfileExperience({
      queryClient,
      username: "blocked-user",
      viewerId: "viewer-1",
      viewerKey: "viewer-1",
      viewerUsername: "viewer",
    });

    expect(mockGetProfileOverviewProjection).not.toHaveBeenCalled();
    expect(
      queryClient.getQueryData(projectionKeys.profileOverview("blocked-user", "viewer-1")),
    ).toBeUndefined();
  });
});
