import { QueryClient } from "@tanstack/react-query";
import { applyMutationRefreshPolicy } from "./mutationPolicy";
import { markProjectionStale, resetProjectionScope, touchProjectionQueries } from "./patchEnvelope";
import { refreshProjectionScope, replaceProjectionScope } from "./projectionRefresh";

jest.mock("./patchEnvelope", () => ({
  applyEntityPatches: jest.fn(),
  markProjectionStale: jest.fn(),
  resetProjectionScope: jest.fn(),
  touchProjectionQueries: jest.fn(),
}));

jest.mock("./projectionRefresh", () => ({
  refreshProjectionScope: jest.fn(),
  replaceProjectionScope: jest.fn(),
}));

describe("mutationPolicy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("dedupes repeated keys inside each refresh bucket", () => {
    const queryClient = new QueryClient();
    const invalidateQueries = jest
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);
    const projectionKey = ["screen", "home", "viewer"];
    const badgeKey = ["badge", "notifications", "viewer"];

    applyMutationRefreshPolicy(queryClient, {
      invalidateKeys: [badgeKey, badgeKey],
      refreshKeys: [projectionKey, projectionKey],
      replaceKeys: [projectionKey, projectionKey],
      resetKeys: [projectionKey, projectionKey],
      staleKeys: [projectionKey, projectionKey],
      touchKeys: [projectionKey, projectionKey],
    });

    expect(touchProjectionQueries).toHaveBeenCalledTimes(1);
    expect(touchProjectionQueries).toHaveBeenCalledWith(queryClient, projectionKey);
    expect(markProjectionStale).toHaveBeenCalledTimes(1);
    expect(markProjectionStale).toHaveBeenCalledWith(queryClient, projectionKey);
    expect(replaceProjectionScope).toHaveBeenCalledTimes(1);
    expect(replaceProjectionScope).toHaveBeenCalledWith(queryClient, projectionKey);
    expect(refreshProjectionScope).toHaveBeenCalledTimes(1);
    expect(refreshProjectionScope).toHaveBeenCalledWith(queryClient, projectionKey);
    expect(resetProjectionScope).toHaveBeenCalledTimes(1);
    expect(resetProjectionScope).toHaveBeenCalledWith(queryClient, projectionKey);
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: badgeKey });
  });

  it("still runs distinct refresh buckets for the same query key", () => {
    const queryClient = new QueryClient();
    const projectionKey = ["screen", "profile-overview", "viewer"];

    applyMutationRefreshPolicy(queryClient, {
      refreshKeys: [projectionKey],
      staleKeys: [projectionKey],
      touchKeys: [projectionKey],
    });

    expect(touchProjectionQueries).toHaveBeenCalledTimes(1);
    expect(markProjectionStale).toHaveBeenCalledTimes(1);
    expect(refreshProjectionScope).toHaveBeenCalledTimes(1);
  });
});
