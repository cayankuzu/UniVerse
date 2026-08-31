import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import {
  clearProjectionPrefetchRegistry,
  readProjectionPrefetch,
} from "../../../data/projections/prefetch/prefetchRegistry";
import { HOME_FEED_ENTITY } from "./homeRepository";
import {
  getHomeStartupSnapshot,
  persistHomeStartupSnapshot,
  primeHomeStartupSnapshotsIntoQueryCache,
  resetHomeStartupSnapshotState,
  subscribeHomeStartupSnapshot,
} from "./homeStartupSnapshot";

const FIXED_NOW = Date.parse("2026-08-19T12:00:00.000Z");

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe("primeHomeStartupSnapshotsIntoQueryCache", () => {
  beforeEach(async () => {
    jest.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
    clearProjectionPrefetchRegistry();
    resetHomeStartupSnapshotState();
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("refreshes savedAt without notifying listeners when snapshot content is unchanged", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeHomeStartupSnapshot(listener);

    persistHomeStartupSnapshot({
      filterScope: "all:all:all:newest",
      items: [
        {
          actor: "club",
          event: {
            clubUsername: "club-a",
            id: "event-1",
            startDate: "2026-03-18",
            title: "Primed event",
          },
          id: "event:event-1",
          kind: "event",
          sortDate: "2026-03-18T10:00:00.000Z",
          source: "following",
        } as any,
      ],
      savedAt: 100,
      unreadCount: 7,
      viewerKey: "viewer",
    });

    expect(listener).toHaveBeenCalledTimes(1);
    listener.mockClear();

    persistHomeStartupSnapshot({
      filterScope: "all:all:all:newest",
      items: [
        {
          actor: "club",
          event: {
            clubUsername: "club-a",
            id: "event-1",
            startDate: "2026-03-18",
            title: "Primed event",
          },
          id: "event:event-1",
          kind: "event",
          sortDate: "2026-03-18T10:00:00.000Z",
          source: "following",
        } as any,
      ],
      savedAt: 200,
      unreadCount: 7,
      viewerKey: "viewer",
    });

    expect(listener).not.toHaveBeenCalled();
    expect(getHomeStartupSnapshot("viewer", "all:all:all:newest")).toMatchObject({
      savedAt: 200,
      unreadCount: 7,
    });

    unsubscribe();
  });

  it("seeds Home projection cache, entity rows, badge data, and warmup hit metadata", async () => {
    const queryClient = createQueryClient();
    const queryKey = projectionKeys.home("viewer", "all:all:all:newest");

    persistHomeStartupSnapshot({
      filterScope: "all:all:all:newest",
      items: [
        {
          actor: "club",
          event: {
            clubUsername: "club-a",
            id: "event-1",
            startDate: "2026-03-18",
            title: "Primed event",
          },
          id: "event:event-1",
          kind: "event",
          sortDate: "2026-03-18T10:00:00.000Z",
          source: "following",
        } as any,
      ],
      savedAt: FIXED_NOW,
      unreadCount: 7,
      viewerKey: "viewer",
    });
    await new Promise((resolve) => setTimeout(resolve, 180));

    const result = await primeHomeStartupSnapshotsIntoQueryCache(queryClient);

    expect(result).toMatchObject({
      primedItemCount: 1,
      primedScopeCount: 1,
      source: "startup-snapshot",
    });
    expect(queryClient.getQueryData(queryKey)).toMatchObject({
      forceRefreshMode: "replace",
      ids: ["event:event-1"],
      isStale: true,
    });
    expect(
      queryClient.getQueryData(projectionKeys.entity(HOME_FEED_ENTITY, "event:event-1")),
    ).toMatchObject({
      homePresentation: {
        albumCount: 0,
      },
      id: "event:event-1",
      rowSignature: expect.any(String),
    });
    expect(queryClient.getQueryData(projectionKeys.notificationBadge("viewer"))).toMatchObject({
      unreadCount: 7,
    });
    expect(readProjectionPrefetch(queryKey)).toMatchObject({
      source: "warmup",
      status: "cache-hit",
    });
  });
});
