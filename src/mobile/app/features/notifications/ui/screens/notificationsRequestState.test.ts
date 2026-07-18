import {
  buildPendingFollowRequestSet,
  buildVisibleFollowRequests,
  resolveVisibleFollowRequestStateKey,
} from "../../domain/followRequestState";
import { buildFilterCounts } from "../../application/notificationsCollections";
import type { NotificationItem } from "../../data";

function createFollowRequestNotification(overrides: Partial<NotificationItem>): NotificationItem {
  return {
    createdAt: "2026-03-14T00:00:00.000Z",
    fromImage: "",
    fromName: "Test User",
    fromUserId: "requester-id",
    fromUsername: "requester",
    id: "notification-id",
    message: "seni takip etmek istiyor",
    read: false,
    targetType: "profile",
    time: "simdi",
    type: "follow_request",
    ...overrides,
  };
}

describe("notifications request state helpers", () => {
  it("keeps only the latest follow request per requester", () => {
    const notifications = [
      createFollowRequestNotification({
        createdAt: "2026-03-14T00:00:00.000Z",
        id: "old-rejected",
        requestResolvedAt: "2026-03-14T00:05:00.000Z",
        requestStatus: "rejected",
      }),
      createFollowRequestNotification({
        createdAt: "2026-03-14T00:06:00.000Z",
        id: "new-accepted",
        requestResolvedAt: "2026-03-14T00:10:00.000Z",
        requestStatus: "accepted",
      }),
      createFollowRequestNotification({
        createdAt: "2026-03-14T00:07:00.000Z",
        fromUserId: "other-id",
        fromUsername: "other-user",
        id: "other-pending",
        requestStatus: "pending",
      }),
    ] satisfies NotificationItem[];

    const requests = buildVisibleFollowRequests(notifications);

    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({
      notificationId: "new-accepted",
      requestStatus: "accepted",
      username: "requester",
    });
    expect(requests[1]).toMatchObject({
      notificationId: "other-pending",
      requestStatus: "pending",
      username: "other-user",
    });
    expect(buildPendingFollowRequestSet(requests)).toEqual(new Set(["other-user"]));
  });

  it("dedupes follow request filter counts by requester", () => {
    const notifications = [
      createFollowRequestNotification({ id: "request-1" }),
      createFollowRequestNotification({ id: "request-2", requestStatus: "rejected" }),
      createFollowRequestNotification({
        fromUserId: "other-id",
        fromUsername: "other-user",
        id: "request-3",
      }),
    ] satisfies NotificationItem[];

    expect(buildFilterCounts(notifications).social).toBe(2);
  });

  it("uses the request-specific key for inline request state", () => {
    expect(
      resolveVisibleFollowRequestStateKey({
        notificationId: "notification-id",
        requestKey: "follow:requester:2026-03-14t00:00:00.000z",
        username: "requester",
      }),
    ).toBe("follow:requester:2026-03-14t00:00:00.000z");
  });
});
