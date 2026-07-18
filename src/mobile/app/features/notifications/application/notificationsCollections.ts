import type { NotificationItem } from "../../../data/contracts/api";
import {
  buildPendingFollowRequestSet,
  buildVisibleFollowRequests,
  type VisibleFollowRequest,
} from "../domain/followRequestState";
import { toFilterCategory, type FilterCategory } from "./notificationsPresentation";

type NotificationsInboxCollections = {
  filterCounts: Record<FilterCategory, number>;
  listItems: NotificationItem[];
  notifications: NotificationItem[];
  pendingFollowRequestSet: Set<string>;
  unreadNotificationCount: number;
  visibleFollowRequests: VisibleFollowRequest[];
};

export function buildBlockedUsernameSet(blockedUsers: Array<string | null | undefined>) {
  return new Set(
    blockedUsers
      .map((item) =>
        String(item || "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean),
  );
}

export function filterBlockedNotifications(items: NotificationItem[], blockedSet: Set<string>) {
  return items.filter(
    (item) =>
      !blockedSet.has(
        String(item.fromUsername || "")
          .trim()
          .toLowerCase(),
      ),
  );
}

export function buildFilterCounts(notifications: NotificationItem[]) {
  const counts: Record<FilterCategory, number> = {
    all: 0,
    social: 0,
    like: 0,
    comment: 0,
    club: 0,
  };
  const seenFollowRequestActors = new Set<string>();

  notifications.forEach((item) => {
    const category = toFilterCategory(String(item.type));
    if (String(item.type) === "follow_request") {
      const actorKey = String(item.fromUserId || item.fromUsername || "")
        .trim()
        .toLowerCase();
      if (!actorKey || seenFollowRequestActors.has(actorKey)) return;
      seenFollowRequestActors.add(actorKey);
      counts.all += 1;
      counts.social += 1;
      return;
    }
    counts.all += 1;
    if (category !== "all" && category in counts) counts[category] += 1;
  });

  return counts;
}

export function filterNotificationsByCategory(
  notifications: NotificationItem[],
  activeFilter: FilterCategory,
) {
  return notifications.filter((item) => {
    const category = toFilterCategory(String(item.type));
    if (activeFilter === "all") return true;
    return category === activeFilter;
  });
}

export function buildListItems(
  filteredNotifications: NotificationItem[],
  visibleFollowRequestCount: number,
) {
  return filteredNotifications.filter((item) =>
    String(item.type) === "follow_request" ? visibleFollowRequestCount === 0 : true,
  );
}

export function deriveNotificationsInboxCollections(params: {
  activeFilter: FilterCategory;
  blockedSet: Set<string>;
  items: NotificationItem[];
}): NotificationsInboxCollections {
  const notifications = filterBlockedNotifications(params.items, params.blockedSet);
  const visibleFollowRequests = buildVisibleFollowRequests(notifications);
  const pendingFollowRequestSet = buildPendingFollowRequestSet(visibleFollowRequests);
  const filteredNotifications = filterNotificationsByCategory(notifications, params.activeFilter);

  return {
    filterCounts: buildFilterCounts(notifications),
    listItems: buildListItems(filteredNotifications, visibleFollowRequests.length),
    notifications,
    pendingFollowRequestSet,
    unreadNotificationCount: notifications.reduce(
      (count, item) => (item.read ? count : count + 1),
      0,
    ),
    visibleFollowRequests,
  };
}
