import type { NotificationItem } from "../../../data/contracts/api";
import { deriveNotificationsInboxCollections } from "./notificationsCollections";

function createNotification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    createdAt: "2026-03-14T00:00:00.000Z",
    fromImage: "",
    fromName: "Test User",
    fromUserId: "requester-id",
    fromUsername: "requester",
    id: "notification-id",
    message: "bildirim",
    read: false,
    targetType: "profile",
    time: "simdi",
    type: "follow_request",
    ...overrides,
  };
}

describe("deriveNotificationsInboxCollections", () => {
  it("derives inbox collections once from blocked and filtered notifications", () => {
    const result = deriveNotificationsInboxCollections({
      activeFilter: "all",
      blockedSet: new Set(["blocked-user"]),
      items: [
        createNotification({ id: "request-1" }),
        createNotification({
          createdAt: "2026-03-14T00:02:00.000Z",
          fromUserId: "other-id",
          fromUsername: "other-user",
          id: "request-2",
        }),
        createNotification({
          fromUserId: "blocked-id",
          fromUsername: "blocked-user",
          id: "blocked-request",
        }),
        createNotification({
          id: "like-1",
          message: "fotoğrafını beğendi",
          read: true,
          type: "like",
        }),
      ],
    });

    expect(result.notifications.map((item) => item.id)).toEqual([
      "request-1",
      "request-2",
      "like-1",
    ]);
    expect(result.unreadNotificationCount).toBe(2);
    expect(result.visibleFollowRequests).toHaveLength(2);
    expect(result.pendingFollowRequestSet).toEqual(new Set(["requester", "other-user"]));
    expect(result.filterCounts).toMatchObject({
      all: 3,
      social: 2,
      like: 1,
    });
    expect(result.listItems).toEqual([expect.objectContaining({ id: "like-1" })]);
  });
});
