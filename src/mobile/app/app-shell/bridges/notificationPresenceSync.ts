import type { QueryClient } from "@tanstack/react-query";
import {
  fetchNotificationBadge,
  fetchNotifications,
} from "../../data/notifications/notificationsProjectionRepository";
import { applyProjectionEnvelope, projectionKeys } from "../../data/projections";
import { logProjectionMetric } from "../../platform/observability";

const DEFAULT_NOTIFICATION_PRESENCE_SYNC_LIMIT = 12;

export type NotificationPresenceSyncResult = {
  hydratedBadge: boolean;
  hydratedNotifications: boolean;
  unreadCount: number;
};

export async function hydrateNotificationPresence(params: {
  limit?: number;
  hydrateListWhenMissing?: boolean;
  queryClient: QueryClient;
  reason?: string;
  viewerId: string;
  viewerKey: string;
}): Promise<NotificationPresenceSyncResult | null> {
  const {
    hydrateListWhenMissing = false,
    limit = DEFAULT_NOTIFICATION_PRESENCE_SYNC_LIMIT,
    queryClient,
    viewerId,
    viewerKey,
  } = params;
  const reason = String(params.reason || "unspecified").trim() || "unspecified";
  const notificationsKey = projectionKeys.notifications(viewerKey, "all");
  const hasCachedNotifications = Boolean(
    queryClient.getQueryState(notificationsKey)?.dataUpdatedAt,
  );
  const shouldHydrateNotifications = hasCachedNotifications || hydrateListWhenMissing;

  try {
    const [badge, notifications] = await Promise.all([
      fetchNotificationBadge(viewerId).catch(() => null),
      shouldHydrateNotifications
        ? fetchNotifications("all", viewerId, { limit }).catch(() => null)
        : Promise.resolve(null),
    ]);

    if (badge) {
      queryClient.setQueryData(projectionKeys.notificationBadge(viewerKey), badge);
    }

    if (notifications) {
      applyProjectionEnvelope({
        entity: "notifications",
        envelope: notifications,
        mode: "replace",
        queryClient,
        screenKey: notificationsKey,
      });
    }

    const result: NotificationPresenceSyncResult = {
      hydratedBadge: Boolean(badge),
      hydratedNotifications: Boolean(notifications),
      unreadCount: Math.max(0, Number(badge?.unreadCount || 0)),
    };

    logProjectionMetric({
      meta: {
        hydratedBadge: result.hydratedBadge,
        hydratedNotifications: result.hydratedNotifications,
        reason,
        unreadCount: result.unreadCount,
      },
      name: "notification_presence_sync",
      screenKey: viewerKey,
      status: "ok",
    });

    return result;
  } catch (error) {
    logProjectionMetric({
      meta: {
        message: String(
          (error as { message?: string } | null)?.message || "notification-presence-sync-failed",
        ),
        reason,
      },
      name: "notification_presence_sync",
      screenKey: viewerKey,
      status: "rollback",
    });
    return null;
  }
}
