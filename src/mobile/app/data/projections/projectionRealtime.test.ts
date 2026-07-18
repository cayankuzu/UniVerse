import { QueryClient } from "@tanstack/react-query";
import { projectionKeys } from "./projectionKeys";
import { createProjectionScreenState } from "./projectionMerge";
import { serializeProjectionKey } from "./projections";
import { getUiScreenState, resetUiViewStateStore } from "./uiViewState";
import { applyProjectionRealtimeEvent } from "./projectionRealtime";
import { registerProjectionSync, resetSyncOrchestratorStore } from "./sync/syncOrchestrator";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe("applyProjectionRealtimeEvent", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetSyncOrchestratorStore();
    resetUiViewStateStore();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    resetSyncOrchestratorStore();
    resetUiViewStateStore();
  });

  it("patches notification badge and marks notification projection stale", () => {
    const queryClient = createQueryClient();
    const viewerKey = "viewer";
    const notificationsKey = projectionKeys.notifications(viewerKey, "all");
    queryClient.setQueryData(
      notificationsKey,
      createProjectionScreenState({
        ids: ["n1"],
        nextCursor: null,
        serverTime: "2026-03-12T00:00:00.000Z",
      }),
    );

    applyProjectionRealtimeEvent({
      event: {
        kind: "notifications-upsert",
        unreadDelta: 1,
        viewerKey,
      },
      queryClient,
    });

    expect(queryClient.getQueryData(projectionKeys.notificationBadge(viewerKey))).toEqual({
      id: "notifications",
      unreadCount: 1,
    });
    expect((queryClient.getQueryData(notificationsKey) as { isStale?: boolean }).isStale).toBe(
      true,
    );
    expect(getUiScreenState(serializeProjectionKey(notificationsKey)).newContentAvailable).toBe(
      true,
    );
  });

  it("marks home and relationship projections stale on profile social changes", () => {
    const queryClient = createQueryClient();
    const homeKey = projectionKeys.screen("home", "viewer");
    const notificationsKey = projectionKeys.notifications("viewer", "all");
    const eventCommentsKey = projectionKeys.eventComments("event-1");
    const relationshipsKey = projectionKeys.relationships("targetuser", "followers", "viewer");
    const otherViewerRelationshipsKey = projectionKeys.relationships(
      "targetuser",
      "followers",
      "someone-else",
    );
    queryClient.setQueryData(
      homeKey,
      createProjectionScreenState({
        ids: ["1"],
        nextCursor: null,
        serverTime: "2026-03-12T00:00:00.000Z",
      }),
    );
    queryClient.setQueryData(
      notificationsKey,
      createProjectionScreenState({
        ids: ["notif-1"],
        nextCursor: null,
        serverTime: "2026-03-12T00:00:00.000Z",
      }),
    );
    queryClient.setQueryData(
      eventCommentsKey,
      createProjectionScreenState({
        ids: ["comment-1"],
        nextCursor: null,
        serverTime: "2026-03-12T00:00:00.000Z",
      }),
    );
    queryClient.setQueryData(
      relationshipsKey,
      createProjectionScreenState({
        ids: ["2"],
        nextCursor: null,
        serverTime: "2026-03-12T00:00:00.000Z",
      }),
    );
    queryClient.setQueryData(
      otherViewerRelationshipsKey,
      createProjectionScreenState({
        ids: ["3"],
        nextCursor: null,
        serverTime: "2026-03-12T00:00:00.000Z",
      }),
    );

    applyProjectionRealtimeEvent({
      event: {
        kind: "profile-social-changed",
        targetProfileIds: [],
        targetUsernames: ["targetuser"],
        viewerKey: "viewer",
        viewerUsername: "viewername",
      },
      queryClient,
    });

    expect((queryClient.getQueryData(homeKey) as { isStale?: boolean }).isStale).toBe(true);
    expect((queryClient.getQueryData(notificationsKey) as { isStale?: boolean }).isStale).toBe(
      true,
    );
    expect((queryClient.getQueryData(eventCommentsKey) as { isStale?: boolean }).isStale).toBe(
      true,
    );
    expect((queryClient.getQueryData(relationshipsKey) as { isStale?: boolean }).isStale).toBe(
      true,
    );
    expect(
      (queryClient.getQueryData(otherViewerRelationshipsKey) as { isStale?: boolean } | undefined)
        ?.isStale,
    ).not.toBe(true);
  });

  it("marks only matching content projections stale for scoped engagement changes", () => {
    const queryClient = createQueryClient();
    const viewerKey = "viewer";
    const eventDetailKey = projectionKeys.eventDetail("event-1", viewerKey);
    const otherEventDetailKey = projectionKeys.eventDetail("event-2", viewerKey);
    const profileEventsKey = projectionKeys.profileContent("alice", "events", viewerKey);
    const profileAlbumsKey = projectionKeys.profileContent("alice", "album", viewerKey);
    const albumEventKey = projectionKeys.albumEvent("event-9", viewerKey);
    queryClient.setQueryData(
      eventDetailKey,
      createProjectionScreenState({
        ids: ["event-1"],
        nextCursor: null,
        serverTime: "2026-03-12T00:00:00.000Z",
      }),
    );
    queryClient.setQueryData(
      otherEventDetailKey,
      createProjectionScreenState({
        ids: ["event-2"],
        nextCursor: null,
        serverTime: "2026-03-12T00:00:00.000Z",
      }),
    );
    queryClient.setQueryData(
      profileEventsKey,
      createProjectionScreenState({
        ids: ["event-1", "event-7"],
        nextCursor: null,
        serverTime: "2026-03-12T00:00:00.000Z",
      }),
    );
    queryClient.setQueryData(
      profileAlbumsKey,
      createProjectionScreenState({
        ids: ["photo-5"],
        nextCursor: null,
        serverTime: "2026-03-12T00:00:00.000Z",
      }),
    );
    queryClient.setQueryData(
      albumEventKey,
      createProjectionScreenState({
        ids: ["photo-5", "photo-6"],
        nextCursor: null,
        serverTime: "2026-03-12T00:00:00.000Z",
      }),
    );

    applyProjectionRealtimeEvent({
      event: {
        eventIds: ["event-1"],
        kind: "content-engagement-changed",
        photoIds: ["photo-5"],
        viewerKey,
      },
      queryClient,
    });

    expect((queryClient.getQueryData(eventDetailKey) as { isStale?: boolean }).isStale).toBe(true);
    expect(
      (queryClient.getQueryData(otherEventDetailKey) as { isStale?: boolean } | undefined)?.isStale,
    ).not.toBe(true);
    expect((queryClient.getQueryData(profileEventsKey) as { isStale?: boolean }).isStale).toBe(
      true,
    );
    expect((queryClient.getQueryData(profileAlbumsKey) as { isStale?: boolean }).isStale).toBe(
      true,
    );
    expect((queryClient.getQueryData(albumEventKey) as { isStale?: boolean }).isStale).toBe(true);
  });

  it("defers projection sync scheduling while the app is backgrounded", async () => {
    const queryClient = createQueryClient();
    const viewerKey = "viewer";
    const notificationsKey = projectionKeys.notifications(viewerKey, "all");
    const serializedKey = serializeProjectionKey(notificationsKey);
    const sync = jest.fn().mockResolvedValue(undefined);

    queryClient.setQueryData(
      notificationsKey,
      createProjectionScreenState({
        ids: ["n1"],
        nextCursor: null,
        serverTime: "2026-03-12T00:00:00.000Z",
      }),
    );
    registerProjectionSync(serializedKey, {
      entity: "notifications",
      freshnessSlaMs: 0,
      prefetchPolicy: "none",
      queryKey: notificationsKey,
      sync,
    });

    applyProjectionRealtimeEvent({
      deferSync: true,
      event: {
        kind: "notifications-updated",
        viewerKey,
      },
      queryClient,
    });

    jest.advanceTimersByTime(500);
    await Promise.resolve();

    expect(sync).not.toHaveBeenCalled();
    expect((queryClient.getQueryData(notificationsKey) as { isStale?: boolean }).isStale).toBe(
      true,
    );
    expect(getUiScreenState(serializedKey).newContentAvailable).toBe(true);
  });
});
