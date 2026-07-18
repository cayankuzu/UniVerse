jest.mock("../../data/notifications/notificationsProjectionRepository", () => ({
  fetchNotificationBadge: jest.fn(),
  fetchNotifications: jest.fn(),
}));

jest.mock("../../platform/observability", () => ({
  logProjectionMetric: jest.fn(),
}));

import { QueryClient } from "@tanstack/react-query";
import {
  fetchNotificationBadge,
  fetchNotifications,
} from "../../data/notifications/notificationsProjectionRepository";
import { projectionKeys } from "../../data/projections";
import { hydrateNotificationPresence } from "./notificationPresenceSync";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe("hydrateNotificationPresence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("hydrates the badge and notifications projection from global sync", async () => {
    const queryClient = createQueryClient();
    (fetchNotificationBadge as jest.Mock).mockResolvedValue({
      id: "notifications",
      unreadCount: 2,
    });
    (fetchNotifications as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-1",
      items: [{ id: "notif-1", read: false, type: "like" }],
      nextCursor: null,
      serverTime: "2026-06-27T10:00:00.000Z",
      updatedItems: [],
    });

    const result = await hydrateNotificationPresence({
      hydrateListWhenMissing: true,
      queryClient,
      reason: "test-sync",
      viewerId: "viewer-1",
      viewerKey: "viewer",
    });

    expect(result).toEqual({
      hydratedBadge: true,
      hydratedNotifications: true,
      unreadCount: 2,
    });
    expect(queryClient.getQueryData(projectionKeys.notificationBadge("viewer"))).toEqual({
      id: "notifications",
      unreadCount: 2,
    });
    expect(queryClient.getQueryData(projectionKeys.notifications("viewer", "all"))).toEqual(
      expect.objectContaining({
        ids: ["notif-1"],
      }),
    );
  });

  it("writes an empty notifications snapshot when the inbox currently has no items", async () => {
    const queryClient = createQueryClient();
    (fetchNotificationBadge as jest.Mock).mockResolvedValue({
      id: "notifications",
      unreadCount: 0,
    });
    (fetchNotifications as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-empty",
      items: [],
      nextCursor: null,
      serverTime: "2026-06-27T10:00:00.000Z",
      updatedItems: [],
    });

    await hydrateNotificationPresence({
      hydrateListWhenMissing: true,
      queryClient,
      reason: "empty-inbox",
      viewerId: "viewer-1",
      viewerKey: "viewer",
    });

    expect(queryClient.getQueryData(projectionKeys.notifications("viewer", "all"))).toEqual(
      expect.objectContaining({
        ids: [],
      }),
    );
  });

  it("skips notifications list hydration when no cache exists and a badge-only sync is enough", async () => {
    const queryClient = createQueryClient();
    (fetchNotificationBadge as jest.Mock).mockResolvedValue({
      id: "notifications",
      unreadCount: 3,
    });

    const result = await hydrateNotificationPresence({
      queryClient,
      reason: "badge-only",
      viewerId: "viewer-1",
      viewerKey: "viewer",
    });

    expect(result).toEqual({
      hydratedBadge: true,
      hydratedNotifications: false,
      unreadCount: 3,
    });
    expect(fetchNotifications).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(projectionKeys.notificationBadge("viewer"))).toEqual({
      id: "notifications",
      unreadCount: 3,
    });
    expect(queryClient.getQueryData(projectionKeys.notifications("viewer", "all"))).toBeUndefined();
  });
});
