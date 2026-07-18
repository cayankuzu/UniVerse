import { QueryClient } from "@tanstack/react-query";
import {
  clearProjectionPrefetchRegistry,
  readProjectionPrefetch,
} from "./prefetch/prefetchRegistry";
import { prefetchProjectionScreen } from "./prefetch/prefetchProjection";

type Item = { id: string; title: string };

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe("prefetchProjectionScreen", () => {
  beforeEach(() => {
    clearProjectionPrefetchRegistry();
  });

  it("skips the network when cached data is still fresh", async () => {
    const queryClient = createQueryClient();
    const fetchProjection = jest.fn();
    const queryKey = ["screen", "home", "viewer", "scope"] as const;

    queryClient.setQueryData(queryKey, {
      ids: ["1"],
      nextCursor: null,
      touchedAt: Date.now(),
    });

    await prefetchProjectionScreen<Item>({
      entity: "home-feed",
      fetchProjection,
      queryClient,
      queryKey,
      source: "tab",
      staleTime: 60_000,
    });

    expect(fetchProjection).not.toHaveBeenCalled();
    expect(readProjectionPrefetch(queryKey)).toMatchObject({
      source: "tab",
      status: "cache-hit",
    });
  });
});
