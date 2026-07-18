jest.mock("../projections/projections.api.helpers", () => ({
  nowEnvelope: (items: unknown[]) => ({
    deletedIds: [],
    deltaToken: "2026-03-30T12:00:00.000Z",
    items,
    nextCursor: null,
    serverTime: "2026-03-30T12:00:00.000Z",
    updatedItems: [],
  }),
  tryProjectionRpc: jest.fn(),
}));

jest.mock("./notificationsApi", () => ({
  NotificationAPI: {
    getAll: jest.fn(),
    getById: jest.fn(),
  },
}));

jest.mock("../social/blockedVisibility", () => {
  const actual = jest.requireActual("../social/blockedVisibility");
  return {
    ...actual,
    loadViewerBlockedVisibility: jest.fn(),
  };
});

import { tryProjectionRpc } from "../projections/projections.api.helpers";
import { loadViewerBlockedVisibility } from "../social/blockedVisibility";
import { NotificationAPI } from "./notificationsApi";
import {
  getNotificationBadge,
  getNotificationById,
  getNotifications,
} from "./notificationsProjectionApi";

describe("getNotifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (loadViewerBlockedVisibility as jest.Mock).mockResolvedValue({
      blockedIds: new Set(["user-blocked"]),
      blockedUsernames: new Set(["blocked-user"]),
      viewerId: "viewer-1",
    });
  });

  it("filters blocked actors out of notification projection rows", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-1",
      items: [
        { fromUserId: "user-blocked", fromUsername: "blocked-user", id: "notif-1", type: "like" },
        {
          fromUserId: "user-visible",
          fromUsername: "visible-user",
          id: "notif-2",
          type: "comment",
        },
      ],
      nextCursor: null,
      serverTime: "2026-03-30T12:00:00.000Z",
      updatedItems: [],
    });

    const result = await getNotifications("all", "viewer-1");

    expect(result.items.map((item) => item.id)).toEqual(["notif-2"]);
    expect(tryProjectionRpc).toHaveBeenCalledWith("notifications_projection", {
      cursor: null,
      delta_token: null,
      filter_name: "all",
      limit_count: 33,
      notification_id: null,
      since: null,
      viewer_id: "viewer-1",
    });
    expect(NotificationAPI.getAll).not.toHaveBeenCalled();
  });

  it("uses the supplied viewer id when projection fallback reads notifications", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValueOnce(null);
    (NotificationAPI.getAll as jest.Mock).mockResolvedValue([
      {
        id: "notif-1",
        fromUserId: "user-visible",
        fromUsername: "visible-user",
        read: false,
        type: "like",
      },
    ]);

    await getNotifications("all", "viewer-1");

    expect(NotificationAPI.getAll).toHaveBeenCalledWith("viewer-1");
  });

  it("falls back to canonical unread total when badge rpc is unavailable", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValueOnce(null);
    (NotificationAPI.getAll as jest.Mock).mockResolvedValue([
      {
        id: "notif-1",
        fromUserId: "user-blocked",
        fromUsername: "blocked-user",
        read: false,
        type: "like",
      },
      {
        id: "notif-2",
        fromUserId: "user-visible",
        fromUsername: "visible-user",
        read: false,
        type: "comment",
      },
      {
        id: "notif-3",
        fromUserId: "user-visible-2",
        fromUsername: "visible-user-2",
        read: true,
        type: "follow",
      },
    ]);

    await expect(getNotificationBadge("viewer-1")).resolves.toEqual({
      id: "notifications",
      unreadCount: 1,
    });

    expect(tryProjectionRpc).toHaveBeenCalledWith("notification_badge_projection", {
      delta_token: null,
      since: null,
      viewer_id: "viewer-1",
    });
    expect(NotificationAPI.getAll).toHaveBeenCalledWith("viewer-1");
  });

  it("resolves one notification through the projection rpc for push tap handling", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValueOnce({
      deletedIds: [],
      deltaToken: "delta-1",
      items: [
        {
          createdAt: "2026-03-30T12:00:00.000Z",
          fromUserId: "user-visible",
          fromUsername: "visible-user",
          id: "notif-1",
          message: "liked your event",
          read: false,
          targetType: "event",
          time: "now",
          type: "like",
        },
      ],
      nextCursor: null,
      serverTime: "2026-03-30T12:00:00.000Z",
      updatedItems: [],
    });

    await expect(getNotificationById("notif-1", "viewer-1")).resolves.toEqual(
      expect.objectContaining({ id: "notif-1" }),
    );

    expect(tryProjectionRpc).toHaveBeenCalledWith("notifications_projection", {
      cursor: null,
      delta_token: null,
      filter_name: "all",
      limit_count: 1,
      notification_id: "notif-1",
      since: null,
      viewer_id: "viewer-1",
    });
    expect(NotificationAPI.getById).not.toHaveBeenCalled();
  });

  it("falls back to canonical single notification reads when the projection rpc is unavailable", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValueOnce(null);
    (NotificationAPI.getById as jest.Mock).mockResolvedValue({
      id: "notif-1",
      fromUserId: "user-visible",
      fromUsername: "visible-user",
      read: false,
      type: "like",
    });

    await expect(getNotificationById("notif-1", "viewer-1")).resolves.toEqual(
      expect.objectContaining({ id: "notif-1" }),
    );

    expect(NotificationAPI.getById).toHaveBeenCalledWith("notif-1", "viewer-1");
  });
});
