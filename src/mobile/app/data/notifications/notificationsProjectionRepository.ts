import type { ProjectionFetchContext } from "../projections/contracts";
import type { ProjectionEnvelope } from "../query/contracts";
import { getViewerKey } from "../contracts/viewerKey";
import type { NotificationItem } from "../contracts/api";
import type { NotificationBadgeProjection } from "../projections/projections.types";
import type { ProjectionRequestContext } from "../projections/projections.request";
import { NotificationAPI } from "./notificationsApi";
import type { ClientMutationOptions } from "../mutations/clientMutation";
import { projectionKeys } from "../projections/projectionKeys";
import {
  CACHE_WARM_STALE_TIMES,
  INITIAL_PAGE_SIZES,
  PAGE_SIZES,
  STALE_TIMES,
} from "../projections/cacheConfig";
import { NOTIFICATIONS_PROJECTION_POLICY } from "../projections/policies/projectionPolicies";
import type { ViewerContext } from "../projections/viewerContext";
import { getNotificationBadge, getNotifications } from "./notificationsProjectionApi";

export function fetchNotifications(
  filter: string,
  viewerId?: string,
  context: ProjectionRequestContext = {},
): Promise<ProjectionEnvelope<NotificationItem>> {
  return getNotifications(filter, viewerId, context);
}

export function fetchNotificationBadge(viewerId?: string): Promise<NotificationBadgeProjection> {
  return getNotificationBadge(viewerId);
}

export function markNotificationRead(notificationId: string, options?: ClientMutationOptions) {
  return NotificationAPI.markRead(notificationId, options);
}

export function markAllNotificationsRead(options?: ClientMutationOptions) {
  return NotificationAPI.markAllRead(options);
}

export function getNotificationsQueryDef(params: { filter: string; viewer: ViewerContext }) {
  const viewerKey = getViewerKey(params.viewer);
  return {
    cacheWarmStaleTime: CACHE_WARM_STALE_TIMES.notifications,
    entity: "notifications" as const,
    fetchProjection: ({ cursor, deltaToken, limit, since }: ProjectionFetchContext) =>
      fetchNotifications(params.filter, params.viewer.id, {
        cursor,
        deltaToken,
        limit:
          !cursor && !deltaToken && !since
            ? Math.min(limit ?? PAGE_SIZES.notifications, INITIAL_PAGE_SIZES.notifications)
            : (limit ?? PAGE_SIZES.notifications),
        since,
      }),
    pageSize: PAGE_SIZES.notifications,
    policy: NOTIFICATIONS_PROJECTION_POLICY,
    queryKey: projectionKeys.notifications(viewerKey, params.filter),
    staleTime: STALE_TIMES.notifications,
  };
}

export function getNotificationBadgeQueryDef(viewer: ViewerContext) {
  const viewerKey = getViewerKey(viewer);
  return {
    queryFn: () => fetchNotificationBadge(viewer.id),
    queryKey: projectionKeys.notificationBadge(viewerKey),
    staleTime: STALE_TIMES.notificationBadge,
  };
}
