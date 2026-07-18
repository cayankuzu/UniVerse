import type { NotificationItem } from "../contracts/api";
import { timeAgo } from "../../shared/utils/dateTime";

type AnyRecord = Record<string, unknown>;

const NOTIFICATION_TYPES: ReadonlySet<NotificationItem["type"]> = new Set([
  "follow",
  "follow_request",
  "follow_accepted",
  "like",
  "comment",
  "event",
  "join",
  "join_request",
  "join_accepted",
  "join_rejected",
  "system",
]);

export function normalizeRequestStatus(
  value: unknown,
): NotificationItem["requestStatus"] | undefined {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  return raw === "pending" || raw === "accepted" || raw === "rejected" ? raw : undefined;
}

function normalizeNotificationType(value: unknown): NotificationItem["type"] | null {
  const raw = String(value || "").trim();
  return NOTIFICATION_TYPES.has(raw as NotificationItem["type"])
    ? (raw as NotificationItem["type"])
    : null;
}

export function normalizeNotificationRow(row: unknown): NotificationItem | null {
  if (!row || typeof row !== "object") return null;
  const item = row as AnyRecord;

  const id = String(item.id || "").trim();
  const type = normalizeNotificationType(item.type);
  const message = String(item.message || "").trim();
  const createdAt = String(item.createdAt || item.created_at || "").trim();
  if (!id || !type || !message || !createdAt) return null;

  const targetTypeRaw = String(item.targetType || item.target_type || "").trim();
  const targetType: "event" | "profile" | "album" =
    targetTypeRaw === "event" || targetTypeRaw === "album" || targetTypeRaw === "profile"
      ? targetTypeRaw
      : item.photoId || item.photo_id
        ? "album"
        : item.eventId || item.event_id
          ? "event"
          : "profile";

  const readRaw = item.read ?? item.is_read ?? false;
  const requestStatus = normalizeRequestStatus(item.requestStatus ?? item.request_status);
  const requestResolvedAt = String(item.requestResolvedAt || item.request_resolved_at || "").trim();

  return {
    id,
    type,
    fromUserId: String(item.fromUserId || item.from_user_id || item.actor_id || "").trim(),
    fromUsername: String(item.fromUsername || item.from_username || "").trim(),
    fromName: String(item.fromName || item.from_name || "").trim(),
    fromImage: String(item.fromImage || item.from_image || "").trim(),
    message,
    detail: item.detail ? String(item.detail) : undefined,
    contentTitle: item.contentTitle
      ? String(item.contentTitle)
      : item.content_title
        ? String(item.content_title)
        : undefined,
    contentSubtitle: item.contentSubtitle
      ? String(item.contentSubtitle)
      : item.content_subtitle
        ? String(item.content_subtitle)
        : undefined,
    eventTitle: item.eventTitle ? String(item.eventTitle) : undefined,
    eventId: item.eventId
      ? String(item.eventId)
      : item.event_id
        ? String(item.event_id)
        : undefined,
    photoId: item.photoId
      ? String(item.photoId)
      : item.photo_id
        ? String(item.photo_id)
        : undefined,
    targetType,
    read: Boolean(readRaw),
    requestStatus,
    requestResolvedAt: requestResolvedAt || undefined,
    createdAt,
    time: item.time ? String(item.time) : timeAgo(createdAt),
  };
}

function compareFollowRequestRecency(left: NotificationItem, right: NotificationItem) {
  const leftTimestamp = Math.max(
    Date.parse(String(left.requestResolvedAt || "")) || 0,
    Date.parse(String(left.createdAt || "")) || 0,
  );
  const rightTimestamp = Math.max(
    Date.parse(String(right.requestResolvedAt || "")) || 0,
    Date.parse(String(right.createdAt || "")) || 0,
  );
  if (leftTimestamp !== rightTimestamp) return leftTimestamp - rightTimestamp;
  return String(left.id || "").localeCompare(String(right.id || ""));
}

export function collapseLatestFollowRequests(items: NotificationItem[]) {
  const passthrough: NotificationItem[] = [];
  const latestByActor = new Map<string, NotificationItem>();

  items.forEach((item) => {
    if (item.type !== "follow_request") {
      passthrough.push(item);
      return;
    }

    const actorKey = String(item.fromUserId || item.fromUsername || "")
      .trim()
      .toLowerCase();
    if (!actorKey) {
      passthrough.push(item);
      return;
    }

    const previous = latestByActor.get(actorKey);
    latestByActor.set(
      actorKey,
      previous && compareFollowRequestRecency(previous, item) > 0 ? previous : item,
    );
  });

  return [...passthrough, ...latestByActor.values()];
}

export function mergeNotifications(...sources: NotificationItem[][]): NotificationItem[] {
  const map = new Map<string, NotificationItem>();
  sources.flat().forEach((item) => {
    const key = String(item.id || "").trim();
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, item);
      return;
    }
    const previous = map.get(key)!;
    map.set(key, { ...previous, ...item });
  });

  return collapseLatestFollowRequests(Array.from(map.values())).sort(
    (left, right) =>
      new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime(),
  );
}
