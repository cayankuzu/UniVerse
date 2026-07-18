import type { ProjectionEnvelope } from "../query/contracts";
import type { NotificationItem } from "../contracts/api";
import { NotificationAPI } from "./notificationsApi";
import { nowEnvelope, tryProjectionRpc } from "../projections/projections.api.helpers";
import {
  createEmptyBlockedVisibilitySnapshot,
  filterBlockedNotificationActors,
  loadViewerBlockedVisibility,
} from "../social/blockedVisibility";
import {
  clampProjectionLimit,
  resolveProjectionDeltaParams,
  type ProjectionRequestContext,
} from "../projections/projections.request";
import type { NotificationBadgeProjection } from "../projections/projections.types";

async function filterNotificationEnvelope(
  envelope: ProjectionEnvelope<NotificationItem>,
  viewerId?: string,
) {
  const blockedVisibility = viewerId
    ? await loadViewerBlockedVisibility(viewerId)
    : createEmptyBlockedVisibilitySnapshot();
  return {
    ...envelope,
    items: filterBlockedNotificationActors(envelope.items || [], blockedVisibility),
    updatedItems: filterBlockedNotificationActors(envelope.updatedItems || [], blockedVisibility),
  };
}

async function filterNotificationItems(items: NotificationItem[], viewerId?: string) {
  const blockedVisibility = viewerId
    ? await loadViewerBlockedVisibility(viewerId)
    : createEmptyBlockedVisibilitySnapshot();
  return filterBlockedNotificationActors(items, blockedVisibility);
}

export async function getNotifications(
  filter: string,
  viewerId?: string,
  context: ProjectionRequestContext = {},
): Promise<ProjectionEnvelope<NotificationItem>> {
  const rpcEnvelope = await tryProjectionRpc<NotificationItem>("notifications_projection", {
    cursor: context.cursor || null,
    ...resolveProjectionDeltaParams(context),
    filter_name: filter,
    limit_count: clampProjectionLimit(context.limit, 33),
    notification_id: null,
    viewer_id: viewerId || null,
  });
  if (rpcEnvelope) return filterNotificationEnvelope(rpcEnvelope, viewerId);

  const rows = await NotificationAPI.getAll(viewerId);
  const items = filter === "all" ? rows : rows.filter((item) => String(item.type) === filter);
  return filterNotificationEnvelope(nowEnvelope(items), viewerId);
}

export async function getNotificationById(
  notificationId: string,
  viewerId?: string,
): Promise<NotificationItem | null> {
  const id = String(notificationId || "").trim();
  if (!id) return null;

  const rpcEnvelope = await tryProjectionRpc<NotificationItem>("notifications_projection", {
    cursor: null,
    delta_token: null,
    filter_name: "all",
    limit_count: 1,
    notification_id: id,
    since: null,
    viewer_id: viewerId || null,
  });
  if (rpcEnvelope) {
    const filteredItems = await filterNotificationItems(rpcEnvelope.items || [], viewerId);
    return filteredItems[0] || null;
  }

  const fallbackItem = await NotificationAPI.getById(id, viewerId);
  const filteredItems = await filterNotificationItems(fallbackItem ? [fallbackItem] : [], viewerId);
  return filteredItems[0] || null;
}

export async function getNotificationBadge(
  viewerId?: string,
): Promise<NotificationBadgeProjection> {
  const rpcEnvelope = await tryProjectionRpc<NotificationBadgeProjection>(
    "notification_badge_projection",
    {
      delta_token: null,
      since: null,
      viewer_id: viewerId || null,
    },
  );
  if (rpcEnvelope?.items?.[0]) return rpcEnvelope.items[0];

  const items = await filterNotificationItems(await NotificationAPI.getAll(viewerId), viewerId);
  return {
    id: "notifications",
    unreadCount: items.reduce((count, item) => (item.read ? count : count + 1), 0),
  };
}
