import type { NotificationItem } from "../../data/contracts/api";

type NotificationResponseLike = {
  actionIdentifier?: unknown;
  notification?: {
    request?: {
      content?: {
        data?: unknown;
      };
      identifier?: unknown;
    };
  };
};

export type PushNotificationNavigationTarget = {
  eventId?: string;
  fromUsername?: string;
  id?: string;
  photoId?: string;
  read?: boolean;
  targetType: NotificationItem["targetType"];
};

export type PushNotificationPayload = {
  eventId?: string;
  fromUsername?: string;
  notificationId?: string;
  photoId?: string;
  targetType?: NotificationItem["targetType"];
};

function normalizeData(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTargetType(value: unknown): NotificationItem["targetType"] | undefined {
  return value === "album" || value === "event" || value === "profile" ? value : undefined;
}

export function parsePushNotificationPayload(
  response: NotificationResponseLike | null | undefined,
): PushNotificationPayload {
  const data = normalizeData(response?.notification?.request?.content?.data);
  const eventId = normalizeText(data.eventId) || undefined;
  const fromUsername = normalizeText(data.fromUsername) || undefined;
  const notificationId = normalizeText(data.notificationId) || undefined;
  const photoId = normalizeText(data.photoId) || undefined;
  const targetType =
    normalizeTargetType(data.targetType) ||
    (photoId ? "album" : eventId ? "event" : fromUsername ? "profile" : undefined);

  return {
    eventId,
    fromUsername,
    notificationId,
    photoId,
    targetType,
  };
}

export function buildPushNotificationNavigationTarget(
  payload: PushNotificationPayload,
): PushNotificationNavigationTarget | null {
  const eventId = normalizeText(payload.eventId) || undefined;
  const fromUsername = normalizeText(payload.fromUsername) || undefined;
  const notificationId = normalizeText(payload.notificationId) || undefined;
  const photoId = normalizeText(payload.photoId) || undefined;
  const targetType =
    normalizeTargetType(payload.targetType) ||
    (photoId ? "album" : eventId ? "event" : fromUsername ? "profile" : undefined);

  if (!targetType) return null;

  return {
    eventId,
    fromUsername,
    id: notificationId,
    photoId,
    targetType,
  };
}

export function canNavigatePushNotificationTarget(
  target: PushNotificationNavigationTarget | null | undefined,
) {
  if (!target) return false;
  if (target.targetType === "profile") {
    return Boolean(normalizeText(target.fromUsername));
  }
  if (target.targetType === "album" || target.targetType === "event") {
    return Boolean(normalizeText(target.eventId));
  }
  return false;
}

export function buildPushNotificationResponseHandlingKey(
  response: NotificationResponseLike | null | undefined,
) {
  const payload = parsePushNotificationPayload(response);
  return [
    normalizeText(response?.notification?.request?.identifier),
    normalizeText(response?.actionIdentifier),
    normalizeText(payload.notificationId),
    normalizeText(payload.targetType),
    normalizeText(payload.eventId),
    normalizeText(payload.photoId),
    normalizeText(payload.fromUsername),
  ]
    .filter(Boolean)
    .join(":");
}
