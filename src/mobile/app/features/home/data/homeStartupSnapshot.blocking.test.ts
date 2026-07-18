import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import { clearProjectionPrefetchRegistry } from "../../../data/projections/prefetch/prefetchRegistry";
import {
  persistHomeStartupSnapshot,
  primeHomeStartupSnapshotsIntoQueryCache,
  removeBlockedActorFromHomeStartupSnapshots,
  resetHomeStartupSnapshotState,
} from "./homeStartupSnapshot";

const mockLoadViewerBlockedVisibility = jest.fn();

jest.mock("../../../data/social/blockedVisibility", () => {
  const actual = jest.requireActual("../../../data/social/blockedVisibility");
  return {
    ...actual,
    loadViewerBlockedVisibility: (...args: unknown[]) => mockLoadViewerBlockedVisibility(...args),
    loadViewerBlockedVisibilityOrEmpty: (...args: unknown[]) =>
      mockLoadViewerBlockedVisibility(...args),
  };
});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe("homeStartupSnapshot blocking isolation", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    clearProjectionPrefetchRegistry();
    resetHomeStartupSnapshotState();
    await AsyncStorage.clear();
    mockLoadViewerBlockedVisibility.mockResolvedValue({
      blockedIds: new Set(["club-blocked"]),
      blockedUsernames: new Set(["blocked-club"]),
      viewerId: "viewer-1",
    });
  });

  it("filters blocked actors before priming startup snapshots into cache", async () => {
    const queryClient = createQueryClient();

    persistHomeStartupSnapshot({
      filterScope: "all:all:all:newest",
      items: [
        {
          actor: "club",
          event: {
            clubUserId: "club-blocked",
            clubUsername: "blocked-club",
            id: "event-hidden",
            startDate: "2026-03-18",
            title: "Hidden event",
          },
          id: "event:event-hidden",
          kind: "event",
          sortDate: "2026-03-18T10:00:00.000Z",
          source: "following",
        } as any,
        {
          actor: "club",
          event: {
            clubUserId: "club-visible",
            clubUsername: "visible-club",
            id: "event-visible",
            startDate: "2026-03-18",
            title: "Visible event",
          },
          id: "event:event-visible",
          kind: "event",
          sortDate: "2026-03-18T11:00:00.000Z",
          source: "following",
        } as any,
      ],
      savedAt: Date.now(),
      unreadCount: 2,
      viewerKey: "viewer-1",
    });
    await new Promise((resolve) => setTimeout(resolve, 180));

    await primeHomeStartupSnapshotsIntoQueryCache(queryClient);

    expect(
      queryClient.getQueryData(projectionKeys.home("viewer-1", "all:all:all:newest")),
    ).toMatchObject({
      ids: ["event:event-visible"],
    });
  });

  it("prunes blocked actors from persisted startup snapshots immediately on block", async () => {
    persistHomeStartupSnapshot({
      filterScope: "all:all:all:newest",
      items: [
        {
          album: {
            clubUserId: "club-blocked",
            clubUsername: "blocked-club",
            id: "album-hidden",
            userId: "user-visible",
            username: "visible-user",
          },
          id: "album:album-hidden",
          kind: "album",
          sortDate: "2026-03-18T10:00:00.000Z",
          source: "following",
        } as any,
      ],
      savedAt: Date.now(),
      unreadCount: 1,
      viewerKey: "viewer-1",
    });

    removeBlockedActorFromHomeStartupSnapshots({
      targetUserId: "club-blocked",
      targetUsername: "blocked-club",
      viewerKey: "viewer-1",
    });

    const queryClient = createQueryClient();
    await new Promise((resolve) => setTimeout(resolve, 180));
    const result = await primeHomeStartupSnapshotsIntoQueryCache(queryClient);

    expect(result).toMatchObject({
      primedItemCount: 0,
      primedScopeCount: 0,
    });
  });
});
