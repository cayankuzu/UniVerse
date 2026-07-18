import type { NotificationItem } from "../contracts/api";
import { nowEnvelope } from "./projections.api.helpers";
import { buildFallbackWarmupBundle } from "./projections.warmup.fallback";

describe("buildFallbackWarmupBundle", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("preserves successful notification pieces when another fallback read times out", async () => {
    const notificationItem = {
      id: "notification-1",
      message: "Yeni bildirim",
      read: false,
      type: "follow",
    } as NotificationItem;

    const promise = buildFallbackWarmupBundle({
      delegates: {
        getHomeFeed: () => new Promise(() => undefined),
        getNotificationBadge: async () => ({
          id: "notifications",
          unreadCount: 3,
        }),
        getNotifications: async () => nowEnvelope([notificationItem]),
        getProfileContent: async () => nowEnvelope([]),
        getProfileOverview: async () => ({}) as any,
        getSearchResults: async () => nowEnvelope([]),
        getViewerRelationshipSnapshot: async () => ({}) as any,
      },
      normalizedViewerUsername: "viewer",
      preferredHomeScope: "all:all:all:newest",
      request: {
        viewerUsername: "viewer",
      },
    });

    await jest.advanceTimersByTimeAsync(1_600);
    const result = await promise;

    expect(result.home.items).toEqual([]);
    expect(result.notificationBadge.unreadCount).toBe(3);
    expect(result.notifications.items).toEqual([notificationItem]);
  });
});
